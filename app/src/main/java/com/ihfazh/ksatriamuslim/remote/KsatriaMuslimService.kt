package com.ihfazh.ksatriamuslim.remote

import com.ihfazh.ksatriamuslim.remote.data.BackgroundResponse
import com.ihfazh.ksatriamuslim.remote.data.BookDetailResponse
import com.ihfazh.ksatriamuslim.remote.data.IndexResponse
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Streaming

interface KsatriaMuslimService {

    @GET("ksatriamuslim_backgrounds/index.json")
    suspend fun getBackgroundIndex(): IndexResponse

    @GET("{path}")
    suspend fun getBackgroundDetail(@Path("path") path: String): BackgroundResponse

    @GET("ksatriamuslim_books/index.json")
    suspend fun getBooks(): IndexResponse

    @GET("{path}")
    suspend fun getBookDetail(@Path("path") path: String): BookDetailResponse

    @GET("ksatriamuslim_audios/index.json")
    suspend fun getAudioSpeakIndex(): IndexResponse

    @GET("{path}")
    @Streaming
    suspend fun getAudio(@Path("path") path: String): okhttp3.ResponseBody
}