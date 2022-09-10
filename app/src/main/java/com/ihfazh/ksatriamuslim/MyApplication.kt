package com.ihfazh.ksatriamuslim

import android.app.Application
import android.content.Context
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.SvgDecoder
import coil.disk.DiskCache
import coil.imageLoader
import coil.memory.MemoryCache
import coil.request.ImageRequest
import com.ihfazh.ksatriamuslim.common.PageSizeCalculator
import com.ihfazh.ksatriamuslim.common.WordSpeak
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.BackendClient
import com.ihfazh.ksatriamuslim.remote.Client
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimBackendService
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimService
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.androidx.workmanager.koin.workManagerFactory
import org.koin.core.context.startKoin
import org.koin.dsl.module
import org.koin.ksp.generated.module
import timber.log.Timber


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

        factory<WordSpeak> {
            WordSpeak(get())
        }

        single<KsatriaMuslimService> {
            Client.getService()
        }

        single {
            PageSizeCalculator(resources.displayMetrics)
        }

        factory {
            imageLoader
        }

        factory<ImageRequest.Builder> {
            ImageRequest.Builder(get<Context>())
        }

    }

    override fun onCreate() {
        super.onCreate()
        Timber.plant(Timber.DebugTree())
        startKoin {
            androidLogger()
            androidContext(this@MyApplication)
            workManagerFactory()
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