package com.ihfazh.ksatriamuslim

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.SvgDecoder
import coil.util.CoilUtils
import com.google.firebase.messaging.FirebaseMessaging
import okhttp3.OkHttpClient

class MyApplication: Application(), ImageLoaderFactory {
    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(applicationContext)
            .crossfade(true)
            .okHttpClient {
                OkHttpClient.Builder()
                    .cache(CoilUtils.createDefaultCache(applicationContext))
                    .build()
            }
            .componentRegistry {
                add(SvgDecoder(applicationContext))
            }
            .build()
    }

    override fun onCreate() {
        super.onCreate()
        FirebaseMessaging.getInstance().apply {
            token.addOnCompleteListener {
                if (it.isComplete) {
                    println("The token is ${it.result}")
                }
            }

            subscribeToTopic(getString(R.string.updateData))
        }
    }
}