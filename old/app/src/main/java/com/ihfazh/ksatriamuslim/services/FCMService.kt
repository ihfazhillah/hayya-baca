package com.ihfazh.ksatriamuslim.services

import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.ihfazh.ksatriamuslim.workers.ForceUpdateAllData

class FCMService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {

        if (remoteMessage.from == "/topics/update_data") {
            handleUpdateData(remoteMessage.data["type"])
        }
    }

    private fun handleUpdateData(type: String? = null) {
        val request = OneTimeWorkRequest.Builder(ForceUpdateAllData::class.java)
            .setInputData(
                workDataOf(
                    "type" to type
                )
            )
            .build()
        WorkManager.getInstance(applicationContext)
            .enqueue(request)
    }

}