package com.ihfazh.ksatriamuslim.repositories

import arrow.core.Either
import com.ihfazh.ksatriamuslim.remote.data.DJError
import com.ihfazh.ksatriamuslim.remote.data.LoginResponse

interface AuthenticationRepository {
    //    suspend fun isLoggedIn(): Boolean
//    fun signOut()
    suspend fun login(email: String, password: String): Either<DJError, LoginResponse>
    fun getToken(): String?
    fun setToken(key: String)
}