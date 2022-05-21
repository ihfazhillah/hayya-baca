package com.ihfazh.ksatriamuslim.repositories

import arrow.core.Either
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimBackendService
import com.ihfazh.ksatriamuslim.remote.data.DJError
import com.ihfazh.ksatriamuslim.remote.data.LoginBody
import com.ihfazh.ksatriamuslim.remote.data.LoginResponse
import retrofit2.Response

class BackendAuthenticationRepository(
    private val remote: KsatriaMuslimBackendService,
    private val sessionManager: SessionManager
) : AuthenticationRepository {
    override suspend fun login(email: String, password: String): Either<DJError, LoginResponse> {
        val body = LoginBody(
            email, password
        )
        return safeRequest {
            remote.login(body)
        }.toEither()
    }

    override fun getToken(): String? {
        return sessionManager.getToken()
    }

    override fun setToken(key: String) {
        sessionManager.setToken(key)
    }

    @Suppress("UNCHECKED_CAST")
    private suspend fun <T> safeRequest(responseFunction: suspend () -> T): T {
        return try {
            responseFunction.invoke()
        } catch (e: Exception) {
            Either.Left(DJError.UnknownApiError(e)) as T
        }

    }
}

fun <T> Response<T>.toEither(): Either<DJError, T> {
    if (isSuccessful) {
        return Either.Right(body()!!)
    }

    if (code() in 400..500) {
        return Either.Left(DJError.HttpError(code(), errorBody()?.string() ?: "Unknown Error"))
    }

    return Either.Left(DJError.UnknownApiError(Exception(errorBody()?.string() ?: "Unknown Error")))
}
