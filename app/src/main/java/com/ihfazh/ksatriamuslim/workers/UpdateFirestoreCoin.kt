package com.ihfazh.ksatriamuslim.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.ihfazh.ksatriamuslim.remote.FirestoreService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class UpdateFirestoreCoin(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val coin = inputData.getInt("coin", -1)
        val id = inputData.getString("id") ?: return Result.failure()

        if (coin < 0) {
            return Result.failure()
        }

        return withContext(Dispatchers.IO) {
            val firestoreService = FirestoreService()
            val updateStatus = firestoreService.updateFireStoreById(id, coin)

            return@withContext if (updateStatus) Result.success() else Result.retry()

        }
    }
}