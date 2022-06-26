package com.ihfazh.ksatriamuslim.activities

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
        val titleMap = mapOf(
            TIME_UP to "DingDong...",
            SCREEN_OFF to "Layar Mati...",
            APPLICATION_CLOSED to "Aplikasi mati..."
        )

        val bodyMap = mapOf(
            TIME_UP to "Waktumu sudah habis. Pastikan koinmu cukup untuk main lagi ya",
            SCREEN_OFF to "Maaf, aplikasi kami matikan ya. Mau buka aplikasi lagi gak perlu bayar kok.",
            APPLICATION_CLOSED to "Maaf, aplikasi kami matikan ya. Mau buka aplikasi lagi gak perlu bayar kok."
        )

        val alertDialog = AlertDialog.Builder(this)
            .setTitle(titleMap[intent.getStringExtra(END_REASON_KEY)])
            .setCancelable(false)
            .setPositiveButton("Stop") { dialog, i ->
                dialog.dismiss()
                val intent = Intent(Intent.ACTION_MAIN)
                intent.addCategory(Intent.CATEGORY_HOME)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                startActivity(intent)
            }
            .setMessage(bodyMap[intent.getStringExtra(END_REASON_KEY)])
        alertDialog.show()
    }

    companion object {
        const val TARGET_PACKAGE = "targetPackage"
        const val END_REASON_KEY = "end_reason"
        const val TIME_UP = "time_up"
        const val SCREEN_OFF = "screen_off"
        const val APPLICATION_CLOSED = "application_closed"
    }
}