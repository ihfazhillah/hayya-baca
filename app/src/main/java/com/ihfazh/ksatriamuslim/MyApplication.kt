package com.ihfazh.ksatriamuslim

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.SvgDecoder
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.BackendClient
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimBackendService
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.context.startKoin
import org.koin.dsl.module

import org.koin.ksp.generated.module


class MyApplication : Application(), ImageLoaderFactory {
    private val appDatabaseModule = module {
        single<AppDatabase> {
            AppDatabase.getDB(get())
        }
    }

    private val backendClientModule = module {
        single<KsatriaMuslimBackendService> {
            BackendClient.getService(get())
        }
    }

    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidLogger()
            androidContext(this@MyApplication)
            modules(
                KsatriaMuslimModule().module,
                appDatabaseModule,
                backendClientModule
            )
        }
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(applicationContext)
            .crossfade(true)
            .memoryCache {
                MemoryCache.Builder(applicationContext)
                    .maxSizePercent(0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(applicationContext.cacheDir.resolve("image_cache"))
                    .maxSizePercent(0.02)
                    .build()
            }
            .components {
                add(SvgDecoder.Factory())
            }
            .build()
    }

}