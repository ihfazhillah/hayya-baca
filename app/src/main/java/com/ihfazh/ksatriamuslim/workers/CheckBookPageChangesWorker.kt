package com.ihfazh.ksatriamuslim.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters
import com.ihfazh.ksatriamuslim.common.BookFileUtils
import com.ihfazh.ksatriamuslim.repositories.BookRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

class CheckBookPageChangesWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams), KoinComponent {

    private val fileUtils: BookFileUtils by inject()
    private val bookRepository: BookRepository by inject()

    private data class BookShouldUpdate(val id: Int, val shouldUpdate: Boolean)

    override suspend fun doWork(): Result {
        return withContext(Dispatchers.IO) {

            val bookAndPagesCount = bookRepository.getBooksAndPageCount()
            val booksShouldUpdate = bookAndPagesCount.map { b ->
                BookShouldUpdate(
                    b.id,
                    (1..b.pageCount).any {
                        fileUtils.shouldReDownload(applicationContext, b.id, it)
                    }
                )
            }

            val data = Data.Builder()
                .putIntArray(
                    "shouldUpdates",
                    booksShouldUpdate.filter { it -> it.shouldUpdate }.map { it -> it.id }
                        .toIntArray()
                )
                .build()

            return@withContext Result.Success(data)


        }
    }
}