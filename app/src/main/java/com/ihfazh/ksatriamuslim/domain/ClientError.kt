package com.ihfazh.ksatriamuslim.domain

sealed class ClientError {
    data class NetworkError(val code: Int, val message: String) : ClientError()
    data class DBError(val throwable: Throwable) : ClientError()
    object UnknownError : ClientError() {
        val message = "Unknown Error"
    }
}