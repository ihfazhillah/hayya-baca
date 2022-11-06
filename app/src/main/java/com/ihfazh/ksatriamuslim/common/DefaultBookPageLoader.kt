package com.ihfazh.ksatriamuslim.common

import android.content.Context
import com.ihfazh.ksatriamuslim.domain.BookMetadataResponse
import com.ihfazh.ksatriamuslim.domain.BookPageUIData
import com.ihfazh.ksatriamuslim.domain.BookReadingResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import org.koin.core.annotation.Factory

@Factory
class DefaultBookPageLoader(
    private val context: Context,
    private val okHttpClient: OkHttpClient,
    pageSizeCalculator: PageSizeCalculator,
    private val bookFileUtils: BookFileUtils
) : BookPageLoader {

    private val sizeQualifier = pageSizeCalculator.guessScreenSizeQualifier()

    private suspend fun loadPageImage(
        book: Int,
        pageNum: Int,
    ): BookReadingResponse {
        val localImageResponse = bookFileUtils.getImageFromLocal(
            context, book, pageNum, sizeQualifier
        )
        return when (localImageResponse) {
            is BookReadingResponse.Success -> {
                localImageResponse
            }
            else -> {
                bookFileUtils.getImageFromWeb(
                    context, okHttpClient, book, pageNum, sizeQualifier
                )
            }
        }
    }

    private suspend fun loadPageMetadata(
        book: Int,
        pageNum: Int,
    ): BookMetadataResponse {

        val localMetadata =
            bookFileUtils.getBookMetadataFromLocal(context, book, pageNum, sizeQualifier)

        return if (localMetadata is BookMetadataResponse.Success) {
            localMetadata
        } else bookFileUtils.getBookMetadataFromWeb(context, book, pageNum, sizeQualifier)
    }

    override suspend fun loadPage(book: Int, pageNum: Int): BookPageUIData {
        return withContext(Dispatchers.IO) {

            val deferredImage = async {
                loadPageImage(book, pageNum)
            }
            val deferredMetadata = async {
                loadPageMetadata(book, pageNum)
            }

            val image = deferredImage.await()
            val metadata = deferredMetadata.await()

            if (image is BookReadingResponse.Success && metadata is BookMetadataResponse.Success) {
                return@withContext BookPageUIData.Success(image.bitmap, metadata.bookMetadata)
            } else {
                return@withContext decideErrorMessage(image, metadata)
            }

        }
    }

    private fun decideErrorMessage(
        imageResponse: BookReadingResponse,
        metadataResponse: BookMetadataResponse
    ): BookPageUIData.Error {
        val errorMap = mapOf(
            BookReadingResponse.ERROR_DOWNLOADING_ERROR to BookPageUIData.DOWNLOAD_ERROR,
            BookReadingResponse.ERROR_NO_INTERNET to BookPageUIData.DOWNLOAD_ERROR,
            BookReadingResponse.ERROR_SD_CARD_NOT_FOUND to BookPageUIData.SDCARD_ERROR,
            BookReadingResponse.ERROR_FILE_NOT_FOUND to BookPageUIData.SDCARD_ERROR
        )
        try {
            val imageError = imageResponse as BookReadingResponse.Error
            return BookPageUIData.Error(
                errorMap[imageError.errorCode] ?: BookPageUIData.UNKNOWN_ERROR
            )
        } catch (e: TypeCastException) {

        }

        return try {
            val metadataError = metadataResponse as BookMetadataResponse.Error
            BookPageUIData.Error(errorMap[metadataError.errorCode] ?: BookPageUIData.UNKNOWN_ERROR)
        } catch (e: TypeCastException) {
            BookPageUIData.Error(BookPageUIData.UNKNOWN_ERROR)
        }
    }
}