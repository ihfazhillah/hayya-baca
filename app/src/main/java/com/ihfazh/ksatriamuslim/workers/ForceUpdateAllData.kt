package com.ihfazh.ksatriamuslim.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.Client
import com.ihfazh.ksatriamuslim.repositories.BookRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.ReadingBackgroundRepositoryImpl
import kotlinx.coroutines.*

class ForceUpdateAllData(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val type = inputData.getString("type") ?: return Result.failure()

        return withContext(Dispatchers.IO) {

            val local = AppDatabase.getDB(applicationContext)
            val remote = Client.getService()

            val bookRepository = BookRepositoryImpl(local, remote)
            val backgroundRepository = ReadingBackgroundRepositoryImpl(local, remote)

            when (type) {
                "all" -> {
                    bookRepository.getBooksSummary(forceFetch = true)
                    backgroundRepository.getBackgrounds(forceFetch = true)
                }
                "onlyBook" -> {
                    bookRepository.getBooksSummary(forceFetch = true)
                    println("only update book")
                }
                "onlyBackground" -> {
                    backgroundRepository.getBackgrounds(forceFetch = true)
                }
            }

            return@withContext Result.success()
        }
    }
}