package com.ihfazh.ksatriamuslim

import android.app.Activity
import android.app.ActivityManager
import android.app.AlertDialog
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import androidx.annotation.RequiresApi

class ApplicationOverlayActivity : Activity() {
    private var targetPackage: String? = ""

    @RequiresApi(Build.VERSION_CODES.Q)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
//        targetPackage = intent.getStringExtra(TARGET_PACKAGE)
//        setContentView(R.layout.activity_application_overlay2)

//        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
//        activityManager.killBackgroundProcesses(targetPackage)
//
//        findViewById<Button>(R.id.back).setOnClickListener{
//            finish()
//        }
        displayStopDialog()
    }

    override fun onPause() {
        super.onPause()

        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val phoneLocked = keyguardManager.isDeviceLocked || keyguardManager.isKeyguardLocked

        val powerManger = getSystemService(Context.POWER_SERVICE) as PowerManager
        val screenAwake = powerManger.isInteractive

        if (!phoneLocked && screenAwake) {
            val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val tasks = am.appTasks
            if (tasks != null && tasks.size > 0) {
                tasks[0].setExcludeFromRecents(true)
            }
        }
    }

    private fun displayStopDialog() {
        val alertDialog = AlertDialog.Builder(this)
            .setTitle("DingDong...")
            .setCancelable(false)
            .setPositiveButton("Stop") { dialog, i ->
                dialog.dismiss()
                val intent = Intent(Intent.ACTION_MAIN)
                intent.addCategory(Intent.CATEGORY_HOME)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                startActivity(intent)
//
//                packageManager.getLaunchIntentForPackage("com.ihfazh.ksatriamuslim")?.let{
//                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
//                    startActivity(intent)
//                    finish()
//                }
            }
            .setMessage("Waktu pakai aplikasi sudah habis")
        alertDialog.show()
    }

    companion object {
        const val TARGET_PACKAGE = "targetPackage"
    }
}