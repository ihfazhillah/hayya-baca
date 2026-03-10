package com.ihfazh.ksatriamuslim.services

import android.app.*
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.CountDownTimer
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.activities.ApplicationOverlayActivity
import com.ihfazh.ksatriamuslim.activities.ForegroundServiceActivity
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.koin.android.ext.android.inject
import java.time.format.DateTimeFormatter

class TimeUpWhatcherService : Service() {
    private var appTime: Float? = null
    private var targetPackage: String? = null
    private var timer: CountDownTimer? = null
    private val appRepository: ApplicationRepository by inject()

    private val dateFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")

    // force change child to null

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)


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

        Log.d(TAG, "onStartCommand: ${intent.action}")
        if (intent.action != null && intent.action == ACTION_STOP_SERVICE) {
            forceStopApp {
                timer?.cancel()
                stopForeground(true)
                stopSelf()
            }
        } else {
            initializeVars(intent)
            // run foreground service
            runForegroundService()
            // setup and start timer
            setupAndStartTimer()
        }
        return super.onStartCommand(intent, flags, startId)
    }

    private fun forceStopApp(callback: () -> Unit) {
        scope.launch {
            callback.invoke()
            val intent =
                Intent(this@TimeUpWhatcherService, ApplicationOverlayActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK xor Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    putExtra(ApplicationOverlayActivity.TARGET_PACKAGE, targetPackage)
                    putExtra(
                        ApplicationOverlayActivity.END_REASON_KEY,
                        ApplicationOverlayActivity.TIME_UP
                    )
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
            "ksatriamuslim_app_fg_service_time_up_app_watcher",
            "Time Up App Watcher",
            NotificationManager.IMPORTANCE_LOW
        )
        val notificationIntent = Intent(this, ForegroundServiceActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 0)
        val builder = NotificationCompat.Builder(this, channelId)
        builder.setCategory(Notification.CATEGORY_SERVICE)

        val selfStopIntent = Intent(this, TimeUpWhatcherService::class.java).apply {
            action = ACTION_STOP_SERVICE
        }
        val selfStopPendingIntent =
            PendingIntent.getService(this, 0, selfStopIntent, PendingIntent.FLAG_CANCEL_CURRENT)
        val stopActionBuilder =
            NotificationCompat.Action.Builder(R.drawable.ic_heart, "Done", selfStopPendingIntent)
                .build()
        builder.addAction(stopActionBuilder)

        val notification = builder.setOngoing(true)
            .setContentText("Lihat Aplikasi, masih berjalan atau tidak")
            .setSubText("Aplikasi gak boleh tetep jalan...")
            .setColor(Color.BLACK)
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
        // 5 minutes
        timer = object : CountDownTimer(300_000, 1000) {
            override fun onTick(p0: Long) {
                scope.launch {
                    Log.d(TAG, "Countdown seconds remaining in service: ${p0 / 1000}")
                    val packageName = getForegroundApp()
                    Log.d(TAG, "onTick: package name in foreground $packageName")
                    if (!appRepository.getAppWatcherState()) {
                        timer?.cancel()
                        stopForeground(true)
                        stopSelf()
                    }
                    if (packageName == targetPackage && appRepository.getAppWatcherState()) {
                        forceStopApp {
//                            timer?.cancel()
//                            stopForeground(true)
//                            stopSelf()
                        }
                    }
                }
            }

            override fun onFinish() {
                Log.d(TAG, "onFinish: Finished. Starting activity")
                scope.launch {
                    appRepository.setAppWatcherState(false)
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

        private val TAG = TimeUpWhatcherService::class.java.simpleName
    }

    override fun onDestroy() {
        super.onDestroy()
        job.cancel()
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

}