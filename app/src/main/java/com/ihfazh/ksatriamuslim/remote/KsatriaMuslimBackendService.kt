package com.ihfazh.ksatriamuslim.remote

import com.ihfazh.ksatriamuslim.remote.data.*
import retrofit2.Response
import retrofit2.http.*

interface KsatriaMuslimBackendService {
    @POST("auth/login/")
    suspend fun login(@Body body: LoginBody): Response<LoginResponse>

    // Child
    @GET("child/")
    suspend fun getChildren(): Response<List<ChildResponse>>

    @GET("child/{id}/")
    suspend fun getChild(@Path("id") id: String): Response<ChildResponse>

    @PUT("child/{id}/")
    suspend fun updateChild(@Path("id") id: String, @Body child: ChildBody): Response<ChildResponse>

    // Rewards
    @POST("reward-history/")
    suspend fun createRewardHistory(@Body body: RewardHistoryBody): Response<RewardHistoryResponse>

    // Books
    @GET("books/")
    suspend fun getBooks(@Query("page") page: Int = 1): Response<BookListResponse>
}