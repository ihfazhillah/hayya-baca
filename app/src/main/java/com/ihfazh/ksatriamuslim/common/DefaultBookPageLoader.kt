package com.ihfazh.ksatriamuslim.common

import android.content.Context
import com.ihfazh.ksatriamuslim.domain.BookPageUIData
import com.ihfazh.ksatriamuslim.domain.BookReadingResponse
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

    override suspend fun loadPage(book: Int, pageNum: Int): BookPageUIData {
        val localImageResponse = bookFileUtils.getImageFromLocal(
            context, book, pageNum, sizeQualifier
        )

        when (localImageResponse) {
            is BookReadingResponse.Success -> return BookPageUIData.Success(
                localImageResponse.bitmap
            )
            else -> {
                val remoteResponse = bookFileUtils.getImageFromWeb(
                    context, okHttpClient, book, pageNum, sizeQualifier
                )

                when (remoteResponse) {
                    is BookReadingResponse.Success -> return BookPageUIData.Success(
                        remoteResponse.bitmap
                    )
                    is BookReadingResponse.Error -> {
                        val errorCode = when (remoteResponse.errorCode) {
                            BookReadingResponse.ERROR_DOWNLOADING_ERROR -> {
                                BookPageUIData.DOWNLOAD_ERROR
                            }
                            BookReadingResponse.ERROR_SD_CARD_NOT_FOUND -> {
                                BookPageUIData.SDCARD_ERROR
                            }
                            else -> {
                                BookPageUIData.UNKNOWN_ERROR
                            }
                        }
                        return BookPageUIData.Error(errorCode)
                    }
                }

            }
        }
    }
}