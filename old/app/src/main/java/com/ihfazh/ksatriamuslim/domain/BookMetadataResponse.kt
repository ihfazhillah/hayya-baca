package com.ihfazh.ksatriamuslim.domain

sealed class BookMetadataResponse {
    companion object {
        const val ERROR_SD_CARD_NOT_FOUND = 1
        const val ERROR_FILE_NOT_FOUND = 2
        const val ERROR_DOWNLOADING_ERROR = 3
        const val ERROR_NO_INTERNET = 4
        const val WARN_SD_CARD_NOT_FOUND = 5
        const val WARN_COULD_NOT_SAVE_FILE = 6
        const val ERROR_UNKNOWN: Int = 7
    }

    data class Success(val bookMetadata: BookMetadata, val warning: Int? = null) :
        BookMetadataResponse()

    data class Error(val errorCode: Int) : BookMetadataResponse()
}
