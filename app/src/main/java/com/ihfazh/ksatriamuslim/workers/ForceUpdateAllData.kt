package com.ihfazh.ksatriamuslim.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ForceUpdateAllData(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val type = inputData.getString("type") ?: return Result.failure()

        return withContext(Dispatchers.IO) {

//            val local = AppDatabase.getDB(applicationContext)
//            val remote = BackendClient.getService(applicationContext)
//
//            val bookRepository = BookRepositoryImpl(local, remote)
//            val remote = BackendClient.getService(applicationContext)
//            val backgroundRepository = ReadingBackgroundRepositoryImpl(local, remote)
//            val audioRepository: SpeakWordRepository =
//                SpeakWordRepositoryImpl(applicationContext, remote, bookRepository)
//
//            when (type) {
//                "all" -> {
//                    bookRepository.getBooksSummary(forceFetch = true)
//                    backgroundRepository.getBackgrounds(forceFetch = true)
//                    audioRepository.saveAudios()
//                }
//                "onlyBook" -> {
//                    bookRepository.getBooksSummary(forceFetch = true)
//                }
//                "onlyBackground" -> {
//                    backgroundRepository.getBackgrounds(forceFetch = true)
//                }
//                "onlyAudios" -> {
//                    audioRepository.saveAudios()
//                }
//            }
//
            return@withContext Result.success()
        }
    }
}