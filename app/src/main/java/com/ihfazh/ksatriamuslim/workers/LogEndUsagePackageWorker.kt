package com.ihfazh.ksatriamuslim.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class LogEndUsagePackageWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams), KoinComponent {

    private val dateFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")
    private val appRepository: ApplicationRepository by inject()

    override suspend fun doWork(): Result {
        val time = inputData.getString("time") ?: return Result.failure()

        // time in string, we need to convert it as local date
        val localDateTime = LocalDateTime.parse(time, dateFormatter)

        return withContext(Dispatchers.IO) {
            val success = appRepository.logEndUsagePackage(localDateTime)
            return@withContext if (success) Result.success() else Result.retry()
        }
    }
}