package com.ihfazh.ksatriamuslim.repositories

interface AuthenticationRepository {
    fun isLoggedIn(): Boolean
}