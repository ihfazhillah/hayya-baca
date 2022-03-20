package com.ihfazh.ksatriamuslim.repositories

interface AuthenticationRepository {
    suspend fun isLoggedIn(): Boolean
}