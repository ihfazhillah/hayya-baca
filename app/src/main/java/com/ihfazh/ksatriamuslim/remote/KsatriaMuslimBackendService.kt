package com.ihfazh.ksatriamuslim.remote

import com.ihfazh.ksatriamuslim.remote.data.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface KsatriaMuslimBackendService {
    @POST("auth/login/")
    suspend fun login(@Body body: LoginBody): Response<LoginResponse>

    // Child
    @GET("child/")
    suspend fun getChildren(): Response<List<ChildResponse>>

    @GET("child/{id}/")
    suspend fun getChild(@Path("id") id: String): Response<ChildResponse>

    // Rewards
    @POST("reward-history/")
    suspend fun createRewardHistory(@Body body: RewardHistoryBody): Response<RewardHistoryResponse>
}