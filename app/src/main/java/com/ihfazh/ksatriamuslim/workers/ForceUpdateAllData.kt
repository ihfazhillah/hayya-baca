package com.ihfazh.ksatriamuslim.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.Client
import com.ihfazh.ksatriamuslim.repositories.BookRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.ReadingBackgroundRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.SpeakWordRepository
import com.ihfazh.ksatriamuslim.repositories.SpeakWordRepositoryImpl
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
            val audioRepository: SpeakWordRepository =
                SpeakWordRepositoryImpl(applicationContext, remote)

            when (type) {
                "all" -> {
                    bookRepository.getBooksSummary(forceFetch = true)
                    backgroundRepository.getBackgrounds(forceFetch = true)
                    audioRepository.saveAudios()
                }
                "onlyBook" -> {
                    bookRepository.getBooksSummary(forceFetch = true)
                }
                "onlyBackground" -> {
                    backgroundRepository.getBackgrounds(forceFetch = true)
                }
                "onlyAudios" -> {
                    audioRepository.saveAudios()
                }
            }

            return@withContext Result.success()
        }
    }
}