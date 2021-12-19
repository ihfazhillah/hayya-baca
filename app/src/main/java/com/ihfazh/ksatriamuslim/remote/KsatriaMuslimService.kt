package com.ihfazh.ksatriamuslim.remote

import com.ihfazh.ksatriamuslim.remote.data.BackgroundResponse
import com.ihfazh.ksatriamuslim.remote.data.IndexResponse
import retrofit2.http.GET
import retrofit2.http.Path

interface KsatriaMuslimService {

    @GET("ksatriamuslim_backgrounds/index.json")
    suspend fun getBackgroundIndex(): IndexResponse

    @GET("{path}")
    suspend fun getBackgroundDetail(@Path("path") path: String): BackgroundResponse
}