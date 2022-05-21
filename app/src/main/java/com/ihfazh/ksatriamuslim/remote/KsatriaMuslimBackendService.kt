package com.ihfazh.ksatriamuslim.remote

import com.ihfazh.ksatriamuslim.remote.data.ChildResponse
import com.ihfazh.ksatriamuslim.remote.data.LoginBody
import com.ihfazh.ksatriamuslim.remote.data.LoginResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface KsatriaMuslimBackendService {
    @POST("auth/login/")
    suspend fun login(@Body body: LoginBody): Response<LoginResponse>

    @GET("child/")
    suspend fun getChildren(): Response<List<ChildResponse>>

    @GET("child/{id}/")
    suspend fun getChild(@Path("id") id: String): Response<ChildResponse>
}