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

    @POST("child/{id}/set_picture/")
    suspend fun setPicture(
        @Path("id") id: String,
        @Body body: SetPictureBody
    ): Response<ChildResponse>

    // ProfilePictures
    @GET("photo-profile/")
    suspend fun getPhotoProfiles(
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 10
    ): Response<ProfilePictureListResponse>

    // Rewards
    @POST("reward-history/")
    suspend fun createRewardHistory(@Body body: RewardHistoryBody): Response<RewardHistoryResponse>

    @POST("reward-history/request_access/")
    suspend fun requestAccess(@Body body: RequestAccessBody): Response<RequestAccessResponse>

    // Books
    @GET("books/")
    suspend fun getBooks(
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 10
    ): Response<BookListResponse>

    @GET("books/{id}/")
    suspend fun getBook(@Path("id") id: Int): Response<BookItem>

    @POST("books/{id}/update_state/")
    suspend fun updateBookState(
        @Path("id") bookId: Int,
        @Body body: UpdateBookStateBody
    ): Response<UpdateBookStateResponse>

    // books state
    @GET("books-state/")
    suspend fun getBooksState(
        @Query("books_id") booksId: List<Int>,
        @Query("child_id") childId: Int?
    ):
            Response<List<BookStateResponse>>

    // paket waktu untuk bermain
    @POST("reward-history/buy_package/")
    suspend fun buyPackage(@Body body: BuyPackageBody): Response<RequestAccessResponse>

    @POST("package-usage/log/")
    suspend fun logUsagePackage(@Body body: UsagePackageLogBody): Response<DefaultOK>
}