package com.ihfazh.ksatriamuslim.remote

import android.content.Context
import com.ihfazh.ksatriamuslim.common.SessionManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory


class BackendClient {
    class AuthInterceptor(context: Context) : Interceptor {
        private val sessionManager = SessionManager(context)

        override fun intercept(chain: Interceptor.Chain): Response {
            val requestBuilder = chain.request().newBuilder()

            // if token has been saved, add it into the request
            sessionManager.getToken()?.let {
                requestBuilder.addHeader("Authorization", "Token $it")
            }

            return chain.proceed(requestBuilder.build())
        }
    }

    companion object {
        private var service: KsatriaMuslimBackendService? = null

        private fun okkHttpClient(context: Context): OkHttpClient =
            OkHttpClient.Builder()
                .addInterceptor(AuthInterceptor(context))
                .addInterceptor(
                    HttpLoggingInterceptor().apply {
                        level = HttpLoggingInterceptor.Level.BODY
                    }
                )
                .build()

        fun getRetrofit(context: Context): Retrofit {
            return Retrofit.Builder()
                .baseUrl(Constants.BASE + "api/")
                .addConverterFactory(GsonConverterFactory.create())
                .client(okkHttpClient(context))
                .build()
        }

        fun getService(context: Context): KsatriaMuslimBackendService {
            return service ?: synchronized(this) {
                service ?: getRetrofit(context).create(KsatriaMuslimBackendService::class.java)
                    .also {
                        service = it
                    }
            }
        }
    }
}