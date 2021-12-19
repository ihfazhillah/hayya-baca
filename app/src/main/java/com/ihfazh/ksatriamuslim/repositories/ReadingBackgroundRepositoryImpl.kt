package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Background
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.local.data.BackgroundEntity
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimService
import com.ihfazh.ksatriamuslim.remote.data.BackgroundResponse

class ReadingBackgroundRepositoryImpl(
    private val local: AppDatabase,
    private val remote: KsatriaMuslimService
): ReadingBackgroundRepository {

    override suspend fun getBackground(): Background? {
        val backgrounds = getBackgrounds()
        return backgrounds?.get((backgrounds.indices).random())
    }

    override suspend fun getBackgrounds(): List<Background>? {
        val localBackgrounds = local.backgroundDao().getAll()

        if (localBackgrounds.isEmpty()){
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


private fun BackgroundResponse.toBackgroundEntity(): BackgroundEntity {
    val id = title.split(" ").joinToString("-")
    return BackgroundEntity(id, title, backgroundImage, textColor)
}

private fun BackgroundResponse.toBackground(): Background {
    val id = title.split(" ").joinToString("-")
    return Background(
        id = id,
        title = title,
        src = backgroundImage,
        text_color = textColor
    )
}

fun List<BackgroundEntity>.toBackgrounds(): List<Background> =
    this.map {
        Background(it.id, it.title, it.src, it.text_color)
    }
