package com.ihfazh.ksatriamuslim.remote

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory


class Client {
    companion object {
        private val service: KsatriaMuslimService? = null

        fun getRetrofit(): Retrofit{
            return Retrofit.Builder()
                .baseUrl("https://ksatriamuslim.com/")
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }

        fun getService(): KsatriaMuslimService {
            return service ?: synchronized(this){
                service ?: getRetrofit().create(KsatriaMuslimService::class.java)
            }
        }
    }
}