package com.ihfazh.ksatriamuslim.fragments

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Process
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.PopupMenu
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.GridLayoutManager
import com.google.android.material.snackbar.Snackbar
import com.ihfazh.ksatriamuslim.MainNavigationDirections
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.adapters.ApplicationChildAdapter
import com.ihfazh.ksatriamuslim.databinding.FragmentApplicationListChildBinding
import com.ihfazh.ksatriamuslim.domain.AppInfo
import com.ihfazh.ksatriamuslim.services.AppTimerService
import com.ihfazh.ksatriamuslim.vm.ApplicationChildListViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import org.koin.androidx.viewmodel.ext.android.viewModel

class ApplicationListChildFragment : Fragment() {

    val appVM: ApplicationChildListViewModel by viewModel()
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
        handleOverlayPermission()
        handleAppUsagePermission()

        appVM.queryApplciations()

        val adapter =
            ApplicationChildAdapter(object : ApplicationChildAdapter.ApplicationItemListener {
                override fun itemClicked(appInfo: AppInfo) {
                    appVM.selectApplication(
                        appInfo,
                        onSuccess = { minutes ->
                            val time = minutes * 60 * 1000
                            val service =
                                Intent(requireContext(), AppTimerService::class.java).apply {
                                    putExtra(AppTimerService.PACKAGE_KEY, appInfo.id)
                                    putExtra(AppTimerService.TIME_KEY, time)
                                }
                            requireActivity().applicationContext.startService(service)

                            requireContext().packageManager.getLaunchIntentForPackage(appInfo.id)
                                ?.let { intent ->
                                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK xor Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                                    startActivity(intent)
                                }
                        },
                        onError = { message ->
                            Snackbar.make(requireView(), message, Snackbar.LENGTH_LONG).show()
                        }
                    )
                }
            })

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                appVM.applications.collectLatest { apps ->
                    adapter.submitData(apps)
                }
            }
        }

        binding?.apply {
            rv.adapter = adapter
            rv.layoutManager = GridLayoutManager(requireContext(), 4)
            menu.setOnClickListener {
                val popup = PopupMenu(requireContext(), menu)
                popup.menuInflater.inflate(R.menu.app_list_menu, popup.menu)
                popup.setOnMenuItemClickListener {
                    if (it.itemId == R.id.edit) {
                        findNavController().navigate(R.id.goToApplicationAdd)
                    } else if (
                        it.itemId == R.id.delete
                    ) {
                        val action = MainNavigationDirections.goToApplicationAdd(true)
                        findNavController().navigate(action)
                    }
                    true
                }
                popup.show()
            }
        }


    }

    private fun handleAppUsagePermission() {
        val appOps = requireContext().getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            "android:get_usage_stats",
            Process.myUid(),
            requireContext().packageName
        )
        val appUsageGranted = mode == AppOpsManager.MODE_ALLOWED
        if (!appUsageGranted) {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            startActivityContract.launch(intent)
        }
    }

    private fun handleOverlayPermission() {
        if (!Settings.canDrawOverlays(requireContext())) {
            // overlay permission
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${requireContext().packageName}")
            )
            startActivityContract.launch(intent)
        }
    }

    companion object {
        private val TAG = ApplicationListChildFragment::class.java.simpleName
    }

    override fun onDestroy() {
        binding = null
        super.onDestroy()
    }

    private val startActivityContract =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            Snackbar.make(requireView(), "You give the permission", Snackbar.LENGTH_LONG).show()
        }
}