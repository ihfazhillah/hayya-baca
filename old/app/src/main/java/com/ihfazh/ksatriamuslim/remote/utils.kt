package com.ihfazh.ksatriamuslim.remote

import okio.IOException


enum class ResultStatus {
    Unknown,
    Success,
    NetworkException,
    RequestException,
    GeneralException
}

class ApiResult<T>(
    val result: T? = null,
    val status: ResultStatus = ResultStatus.Unknown
) {
    val success = status == ResultStatus.Success
}

suspend fun <T> safeApiRequest(
    apiFunction: suspend () -> T
): ApiResult<T> =
    try {
        val result = apiFunction()
        ApiResult(result, ResultStatus.Success)
    } catch (ex: retrofit2.HttpException) {
        ApiResult(status = ResultStatus.RequestException)
    } catch (ex: IOException) {
        ApiResult(status = ResultStatus.NetworkException)
    } catch (ex: Exception) {
        ApiResult(status = ResultStatus.GeneralException)
    }