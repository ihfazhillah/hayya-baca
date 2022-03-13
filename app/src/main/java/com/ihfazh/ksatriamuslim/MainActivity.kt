package com.ihfazh.ksatriamuslim

import android.Manifest
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.Menu
import android.view.MenuItem
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.ihfazh.ksatriamuslim.common.Constants
import com.ihfazh.ksatriamuslim.common.Recognizer
import com.ihfazh.ksatriamuslim.workers.ForceUpdateAllData

class MainActivity : AppCompatActivity() {
    lateinit var navController: NavController


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val navHostFragment = supportFragmentManager.findFragmentById(R.id.main_nav_host) as NavHostFragment
        navController = navHostFragment.navController

        navController.addOnDestinationChangedListener { _, destination, _ ->
            if (destination.id == R.id.readerFragment) {
                supportActionBar?.hide()
            } else {
                supportActionBar?.show()
            }
        }

        handleUpdateDataNotification()

        if (!Constants.isTvVersion(applicationContext)) {
            askPermissionContract.launch(permission)
        }
    }

    private fun handleUpdateDataNotification() {
        val action = intent.getStringExtra("click_action")
        val actionType = intent.getStringExtra("type_action")

        if (action == "update_data") {
            val workerRequest = OneTimeWorkRequest.Builder(ForceUpdateAllData::class.java)
                .setInputData(
                    workDataOf(
                        "type" to actionType
                    )
                )
                .build()

            WorkManager.getInstance(this).enqueue(workerRequest)
        }
    }

//    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
//        menuInflater.inflate(R.menu.main_menu, menu)
//        return super.onCreateOptionsMenu(menu)
//    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        navController.navigate(item.itemId)
        return true
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        val fragmentsCannotBack = listOf(
            R.id.readerFragment,
            R.id.coinCongratulateFragment
        )
        val child = navController.currentDestination?.id
        if (fragmentsCannotBack.contains(child) && keyCode == KeyEvent.KEYCODE_BACK) {
            return false
        }

        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        Recognizer.destroy()
        super.onDestroy()
    }

    // PERMISSIONS
    private val permission = Manifest.permission.RECORD_AUDIO
    private val askPermissionContract =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            if (it) {
                Recognizer.initialize()
            } else {
                Log.w(TAG, "Permission not granted. Recording not started.")
            }
        }

    companion object {
        const val TAG = "MainActivity"
    }
}