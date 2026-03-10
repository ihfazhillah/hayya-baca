package com.ihfazh.ksatriamuslim.domain

interface ErrorHandler {
    fun getError(throwable: Throwable): ErrorEntity
}