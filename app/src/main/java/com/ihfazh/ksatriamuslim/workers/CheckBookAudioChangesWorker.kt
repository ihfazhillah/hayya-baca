package com.ihfazh.ksatriamuslim.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.ihfazh.ksatriamuslim.common.AudioFileUtil
import com.ihfazh.ksatriamuslim.repositories.BookRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

class CheckBookAudioChangesWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams), KoinComponent {

    private val audioFileUtil: AudioFileUtil by inject()
    private val bookRepository: BookRepository by inject()

    private data class BookShouldUpdate(val id: Int, val shouldUpdate: Boolean)

    override suspend fun doWork(): Result {
        return withContext(Dispatchers.IO) {

            val bookAndPagesCount = bookRepository.getBooksAndPageCount()
            val booksShouldUpdate = bookAndPagesCount.forEach { b ->
                audioFileUtil.getAudioFromWeb(b.id)
            }

            return@withContext Result.Success()

        }
    }
}