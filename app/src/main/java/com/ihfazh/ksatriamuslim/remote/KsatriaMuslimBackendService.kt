package com.ihfazh.ksatriamuslim.remote

import com.ihfazh.ksatriamuslim.remote.data.LoginBody
import com.ihfazh.ksatriamuslim.remote.data.LoginResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface KsatriaMuslimBackendService {
    @POST("auth/login/")
    suspend fun login(@Body body: LoginBody): Response<LoginResponse>
}