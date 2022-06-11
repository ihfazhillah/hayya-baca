package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.adapters.ApplicationAdapter
import com.ihfazh.ksatriamuslim.databinding.FragmentApplicationAddBinding
import com.ihfazh.ksatriamuslim.domain.AppInfoSelect
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepository
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepositoryImpl
import com.ihfazh.ksatriamuslim.vm.AppInfoViewModelFactory
import com.ihfazh.ksatriamuslim.vm.ApplicationAddViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

/**
 * A simple [Fragment] subclass.
 * Use the [ApplicationAddFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class ApplicationAddFragment : Fragment() {
    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null

    private var binding: FragmentApplicationAddBinding? = null
    private lateinit var appInfoRepo: ApplicationRepository
    private val viewModel by viewModels<ApplicationAddViewModel> {
        AppInfoViewModelFactory(appInfoRepo)
    }
    private lateinit var adapter: ApplicationAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.let {
            param1 = it.getString(ARG_PARAM1)
            param2 = it.getString(ARG_PARAM2)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        binding = FragmentApplicationAddBinding.inflate(inflater, container, false)
        // Inflate the layout for this fragment
        return binding?.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val appDatabase = AppDatabase.getDB(requireContext())
        appInfoRepo = ApplicationRepositoryImpl(requireContext(), appDatabase)
        adapter = ApplicationAdapter(applicationItemListener = object :
            ApplicationAdapter.ApplicationItemListener {
            override fun itemSelected(appInfo: AppInfoSelect) {
                viewModel.updateApplicationItem(appInfo)
            }
        })

        viewLifecycleOwner.lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.applications.collectLatest { apps ->
                    binding?.appList?.post {
                        adapter.submitData(apps)
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.selectedCount.collectLatest { selectedCount: Int ->
                    binding?.let {
                        if (selectedCount > 0) {
                            it.btnTambah.visibility = View.VISIBLE
                            it.selectAllLabel.text = "$selectedCount terpilih"
                        } else {
                            it.selectAllLabel.text = "Pilih Item"
                            it.btnTambah.visibility = View.GONE
                        }
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.allSelected.collectLatest { allSelected: Boolean ->
                    binding?.let {
                        it.selectAll.isChecked = allSelected
                        if (allSelected) {
                            it.root.setBackgroundResource(R.color.teal_200)
                        } else {
                            it.root.setBackgroundColor(0xfff)
                        }
                    }
                }
            }
        }

        binding?.apply {
            appList.adapter = this@ApplicationAddFragment.adapter
            appList.layoutManager =
                LinearLayoutManager(requireContext(), LinearLayoutManager.VERTICAL, false)
            selectAll.setOnClickListener { viewModel.toggleSelectAll() }
            selectAllLabel.setOnClickListener { viewModel.toggleSelectAll() }
            btnTambah.setOnClickListener {
                viewModel.insertAll()
            }
        }
    }

    companion object {
        /**
         * Use this factory method to create a new instance of
         * this fragment using the provided parameters.
         *
         * @param param1 Parameter 1.
         * @param param2 Parameter 2.
         * @return A new instance of fragment ApplicationAddFragment.
         */
        // TODO: Rename and change types and number of parameters
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            ApplicationAddFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }

    override fun onDestroy() {
        binding = null
        super.onDestroy()
    }
}