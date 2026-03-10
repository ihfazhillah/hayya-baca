package com.ihfazh.ksatriamuslim.domain

import android.graphics.Bitmap

sealed class BookReadingResponse {
    companion object {
        const val ERROR_SD_CARD_NOT_FOUND = 1
        const val ERROR_FILE_NOT_FOUND = 2
        const val ERROR_DOWNLOADING_ERROR = 3
        const val ERROR_NO_INTERNET = 4
        const val WARN_SD_CARD_NOT_FOUND = 5
        const val WARN_COULD_NOT_SAVE_FILE = 6
    }

    data class Success(val bitmap: Bitmap, val warning: Int? = null) : BookReadingResponse()
    data class Error(val errorCode: Int) : BookReadingResponse()
}
