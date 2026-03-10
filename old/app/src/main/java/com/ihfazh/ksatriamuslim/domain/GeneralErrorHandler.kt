package com.ihfazh.ksatriamuslim.domain

import java.io.IOException

class GeneralErrorHandler : ErrorHandler {
    override fun getError(throwable: Throwable): ErrorEntity {
        return when (throwable) {
            is IOException -> ErrorEntity.Network
            // TODO: Handle another exceptions here
            else -> ErrorEntity.Unknown
        }
    }
}