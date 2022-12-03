package com.ihfazh.ksatriamuslim.activities

import android.os.Bundle
import android.view.KeyEvent
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.common.AudioFileUtil
import com.ihfazh.ksatriamuslim.common.Recognizer
import com.ihfazh.ksatriamuslim.workers.CheckBookPageChangesWorker
import com.ihfazh.ksatriamuslim.workers.ForceUpdateAllData
import com.ihfazh.ksatriamuslim.workers.ReDownloadBookImagesWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

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

        setupBookPageChangesWatcher()
        setupAudioChangesWatcher()
    }

    private fun setupAudioChangesWatcher() {
        lifecycleScope.launch(Dispatchers.IO) {
            AudioFileUtil().getAudioFromWeb(applicationContext, 16)
        }
    }

    private fun setupBookPageChangesWatcher() {
        val pageChangesWorkRequest: OneTimeWorkRequest =
            OneTimeWorkRequest.from(CheckBookPageChangesWorker::class.java)
        val redownloadWorkRequest: OneTimeWorkRequest =
            OneTimeWorkRequest.from(ReDownloadBookImagesWorker::class.java)
        WorkManager.getInstance(applicationContext)
            .beginWith(pageChangesWorkRequest)
            .then(redownloadWorkRequest)
            .enqueue()
    }

    override fun onSupportNavigateUp(): Boolean {
        val navHostFragment =
            supportFragmentManager.findFragmentById(R.id.main_nav_host) as NavHostFragment
        navController = navHostFragment.navController
        return navController.navigateUp() || super.onSupportNavigateUp()
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


    companion object {
        const val TAG = "MainActivity"
    }
}