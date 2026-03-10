package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Background
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimService
import com.ihfazh.ksatriamuslim.remote.data.BackgroundResponse
import com.ihfazh.ksatriamuslim.toBackground
import com.ihfazh.ksatriamuslim.toBackgroundEntity
import com.ihfazh.ksatriamuslim.toBackgrounds
import org.koin.core.annotation.Factory

@Factory
class ReadingBackgroundRepositoryImpl(
    private val local: AppDatabase,
    private val remote: KsatriaMuslimService
): ReadingBackgroundRepository {

    override suspend fun getBackground(): Background? {
        val backgrounds = getBackgrounds()
        return backgrounds?.get((backgrounds.indices).random())
    }

    override suspend fun getBackgrounds(forceFetch: Boolean): List<Background>? {
        val localBackgrounds = local.backgroundDao().getAll()

        if (forceFetch || localBackgrounds.isEmpty()){
            val index = remote.getBackgroundIndex()
            val backgroundDetails: List<BackgroundResponse>? = index.urls?.let{ urls ->
                urls.map{
                    val detail = remote.getBackgroundDetail(it)
                    detail
                }
            }

            val backgroundEntities = backgroundDetails?.map{
                it.toBackgroundEntity()
            }

            if (backgroundEntities != null){
                local.backgroundDao().insertAll(backgroundEntities)
            }

            return backgroundDetails?.map{
                it.toBackground()
            }
        }

        return localBackgrounds.toBackgrounds()
    }
}


