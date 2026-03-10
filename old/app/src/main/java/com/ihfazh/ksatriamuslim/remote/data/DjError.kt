package com.ihfazh.ksatriamuslim.remote.data

import com.google.gson.Gson

sealed class DJError {
    data class HttpError(val code: Int, val body: String) : DJError() {
        inline fun <reified T> toObject(): T {
            return Gson().fromJson(body, T::class.java)
        }
    }

    data class NetworkError(val throwable: Throwable) : DJError()
    data class UnknownApiError(val throwable: Throwable) : DJError()
}