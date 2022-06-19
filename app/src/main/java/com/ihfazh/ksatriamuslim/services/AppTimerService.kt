package com.ihfazh.ksatriamuslim.services

import android.app.*
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.CountDownTimer
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.ihfazh.ksatriamuslim.ApplicationOverlayActivity
import com.ihfazh.ksatriamuslim.ForegroundServiceActivity
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.koin.android.ext.android.inject

class AppTimerService : Service() {
    private var appTime: Float? = null
    private var targetPackage: String? = null
    private var timer: CountDownTimer? = null
    val appRepository: ApplicationRepository by inject()

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    lateinit var screenOffReceiver: ScreenOffReceiver

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    // sometime the detected current foreground is not target package
    // maybe caused by the delay
    private var foregroundAppSpan = 0

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return super.onStartCommand(intent, flags, startId)
        }

        val filter = IntentFilter(Intent.ACTION_SCREEN_ON)
        filter.addAction(Intent.ACTION_SCREEN_OFF)
        screenOffReceiver = ScreenOffReceiver {
            logEndPackageUsage(ApplicationOverlayActivity.SCREEN_OFF) {
                timer?.cancel()
                stopForeground(true)
                stopSelf()
            }
        }
        registerReceiver(screenOffReceiver, filter)

        Log.d(TAG, "onStartCommand: ${intent.action}")
        if (intent.action != null && intent.action == ACTION_STOP_SERVICE) {
            logEndPackageUsage(ApplicationOverlayActivity.APPLICATION_CLOSED) {
                timer?.cancel()
                stopForeground(true)
                stopSelf()
            }
        } else {
            initializeVars(intent)
            logStartPackageUsage()
            // run foreground service
            runForegroundService()
            // setup and start timer
            setupAndStartTimer()
        }
        return super.onStartCommand(intent, flags, startId)
    }

    private fun logStartPackageUsage() {
        scope.launch {
            appRepository.logStartUsagePackage()
        }
    }

    private fun logEndPackageUsage(endReason: String, callback: () -> Unit) {
        scope.launch {
            appRepository.logEndUsagePackage()
            callback.invoke()

            val intent =
                Intent(this@AppTimerService, ApplicationOverlayActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK xor Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    putExtra(ApplicationOverlayActivity.TARGET_PACKAGE, targetPackage)
                    putExtra(ApplicationOverlayActivity.END_REASON_KEY, endReason)
                }
            startActivity(intent)
        }

    }

    private fun initializeVars(intent: Intent) {
        appTime = intent.getFloatExtra(TIME_KEY, 0F)
        targetPackage = intent.getStringExtra(PACKAGE_KEY)

        timer?.cancel()
    }

    private fun runForegroundService() {
        val channelId = createNotificationChannel(
            "ksatriamuslim_app_fg_service",
            "Background Service Notification",
            NotificationManager.IMPORTANCE_LOW
        )
        val notificationIntent = Intent(this, ForegroundServiceActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 0)
        val builder = NotificationCompat.Builder(this, channelId)
        val appIntent = packageManager.getLaunchIntentForPackage(targetPackage!!)
        val actionPendingIntent = PendingIntent.getActivity(this, 1, appIntent, 0)
        val actionBuilder = NotificationCompat.Action.Builder(
            R.drawable.ic_100tb,
            "Return to $targetPackage",
            actionPendingIntent
        )
        builder.setCategory(Notification.CATEGORY_SERVICE)

        val selfStopIntent = Intent(this, AppTimerService::class.java).apply {
            action = ACTION_STOP_SERVICE
        }
        val selfStopPendingIntent =
            PendingIntent.getService(this, 0, selfStopIntent, PendingIntent.FLAG_CANCEL_CURRENT)
        val stopActionBuilder =
            NotificationCompat.Action.Builder(R.drawable.ic_heart, "Done", selfStopPendingIntent)
                .build()
        builder.addAction(stopActionBuilder)

        val notification = builder.setOngoing(true)
            .setContentText("App Sedang Berjalan")
            .setSubText("Lihat applikasi lebih lanjut")
            .setColor(Color.BLACK)
            .addAction(actionBuilder.build())
            .setPriority(Notification.PRIORITY_MIN)
            .setSmallIcon(R.drawable.ic_baseline_logout_24)
            .setContentIntent(pendingIntent).build()

        startForeground(FOREGROUND_NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel(
        channelId: String,
        channelName: String,
        importance: Int
    ): String {
        val channel = NotificationChannel(channelId, channelName, importance)
        channel.lightColor = Color.BLUE
        channel.lockscreenVisibility = Notification.VISIBILITY_PRIVATE

        val notifManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notifManager.createNotificationChannel(channel)
        return channelId
    }

    private fun setupAndStartTimer() {
        timer = object : CountDownTimer(appTime!!.toLong(), 1000) {
            override fun onTick(p0: Long) {
                Log.d(TAG, "Countdown seconds remaining in service: ${p0 / 1000}")
                val packageName = getForegroundApp()
                if (packageName != targetPackage) {
                    foregroundAppSpan += 1

                    if (foregroundAppSpan > 5) {
                        logEndPackageUsage(ApplicationOverlayActivity.APPLICATION_CLOSED) {
                            timer?.cancel()
                            stopForeground(true)
                            stopSelf()
                        }
                    }
                }
                Log.d(TAG, "onTick: package name in foreground $packageName")
            }

            override fun onFinish() {
                Log.d(TAG, "onFinish: Finished. Starting activity")
                logEndPackageUsage(ApplicationOverlayActivity.TIME_UP) {
                    stopForeground(true)
                    stopSelf()
                }
            }

        }
        timer?.start()
    }

    companion object {
        const val PACKAGE_KEY = "target_package"
        const val TIME_KEY = "time"
        const val ACTION_STOP_SERVICE = "stop_service"

        const val FOREGROUND_NOTIFICATION_ID = 104

        private val TAG = AppTimerService::class.java.simpleName
    }

    override fun onDestroy() {
        super.onDestroy()
        job.cancel()
        unregisterReceiver(screenOffReceiver)
    }

    private fun getForegroundApp(): String? {
        val usageManager = getSystemService(Service.USAGE_STATS_SERVICE) as UsageStatsManager
        val time = System.currentTimeMillis()

        val events = usageManager.queryEvents(time - 1000 * 3600, time)
        val event = UsageEvents.Event()
        var foregroundApp: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                foregroundApp = event.packageName
            }
        }
        return foregroundApp
    }

    class ScreenOffReceiver(
        private val onScreenOff: () -> Unit
    ) : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            intent?.let {
                if (it.action == Intent.ACTION_SCREEN_OFF) {
                    onScreenOff.invoke()
                }
            }
        }

    }
}