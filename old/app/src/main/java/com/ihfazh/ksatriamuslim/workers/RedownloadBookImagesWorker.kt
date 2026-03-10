package com.ihfazh.ksatriamuslim.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.ihfazh.ksatriamuslim.common.BookFileUtils
import com.ihfazh.ksatriamuslim.common.PageSizeCalculator
import com.ihfazh.ksatriamuslim.repositories.BookRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

class ReDownloadBookImagesWorker(context: Context, workerParameters: WorkerParameters) :
    CoroutineWorker(context, workerParameters), KoinComponent {
    private val bookRepository: BookRepository by inject()
    private val fileUtils: BookFileUtils by inject()
    private val okHttpClient: OkHttpClient by inject()
    private val pageSizeCalculator: PageSizeCalculator by inject()

    override suspend fun doWork(): Result {
        val shouldUpdates = inputData.getIntArray("shouldUpdates")

        return withContext(Dispatchers.IO) {
            shouldUpdates?.forEach {
                val bookPageCount = bookRepository.getBookAndPageCount(it)
                (1..bookPageCount.pageCount).forEach { page ->
                    fileUtils.getImageFromWeb(
                        applicationContext,
                        okHttpClient,
                        bookPageCount.id,
                        page,
                        pageSizeCalculator.guessScreenSizeQualifier()
                    )
                    fileUtils.getBookMetadataFromWeb(
                        applicationContext,
                        it,
                        page,
                        pageSizeCalculator.guessScreenSizeQualifier()
                    )
                }


            }

            return@withContext Result.Success()
        }
    }
}