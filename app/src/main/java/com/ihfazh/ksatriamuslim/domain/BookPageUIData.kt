package com.ihfazh.ksatriamuslim.domain

import android.graphics.Bitmap

sealed class BookPageUIData {
    companion object {
        const val DOWNLOAD_ERROR = "download_error"
        const val SDCARD_ERROR = "sdcard_error"
        const val UNKNOWN_ERROR = "unknown_error"
    }

    data class Success(val bitmap: Bitmap, val metadata: BookMetadata) : BookPageUIData()
    data class Error(val errorCode: String) : BookPageUIData()
}
