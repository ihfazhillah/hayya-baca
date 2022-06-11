package com.ihfazh.ksatriamuslim.fragments

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.GridLayoutManager
import com.google.android.material.snackbar.Snackbar
import com.ihfazh.ksatriamuslim.adapters.ApplicationChildAdapter
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.databinding.FragmentApplicationListChildBinding
import com.ihfazh.ksatriamuslim.domain.AppInfo
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.BackendClient
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepository
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepositoryImpl
import com.ihfazh.ksatriamuslim.vm.AppInfoChildListViewModelFactory
import com.ihfazh.ksatriamuslim.vm.ApplicationChildListViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class ApplicationListChildFragment : Fragment() {

    private lateinit var appInfoRepo: ApplicationRepository
    private val viewModel by viewModels<ApplicationChildListViewModel> {
        AppInfoChildListViewModelFactory(appInfoRepo)
    }
    private var binding: FragmentApplicationListChildBinding? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        binding = FragmentApplicationListChildBinding.inflate(inflater, container, false)
        return binding?.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val appDatabase = AppDatabase.getDB(requireContext())
        val remote = BackendClient.getService(requireContext())
        appInfoRepo = ApplicationRepositoryImpl(
            requireContext(),
            appDatabase,
            remote,
            SessionManager(requireContext())
        )

        val adapter =
            ApplicationChildAdapter(object : ApplicationChildAdapter.ApplicationItemListener {
                override fun itemClicked(appInfo: AppInfo) {
                    viewModel.selectApplication(appInfo)
                }
            })

        viewLifecycleOwner.lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.applications.collectLatest { apps ->
                    adapter.submitData(apps)
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.selectedApplication.collectLatest { app ->
                    app?.let {
                        requireContext().packageManager.getLaunchIntentForPackage(it.id)
                            ?.let { intent ->
                                intent.addFlags(Intent.FLAG_ACTIVITY_PREVIOUS_IS_TOP)
                                startActivity(intent)
                                viewModel.resetApplication()
                            }
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.message.collectLatest { message ->
                    message?.let {
                        Snackbar.make(requireView(), it, Snackbar.LENGTH_LONG).show()
                        viewModel.resetApplication()
                    }
                }
            }
        }
        binding?.apply {
            rv.adapter = adapter
            rv.layoutManager = GridLayoutManager(requireContext(), 4)
        }


    }

    companion object {
        private val TAG = ApplicationListChildFragment::class.java.simpleName
    }

    override fun onDestroy() {
        binding = null
        super.onDestroy()
    }
}