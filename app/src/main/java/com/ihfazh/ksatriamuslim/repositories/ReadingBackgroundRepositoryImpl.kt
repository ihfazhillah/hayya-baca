package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Background
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimService
import com.ihfazh.ksatriamuslim.remote.data.BackgroundResponse

class ReadingBackgroundRepositoryImpl(
    private val remote: KsatriaMuslimService
): ReadingBackgroundRepository {

    override suspend fun getBackground(): Background? {
        val backgrounds = getBackgrounds()
        return backgrounds?.get((backgrounds.indices).random())
    }

    override suspend fun getBackgrounds(): List<Background>? {
        val index = remote.getBackgroundIndex()
        val backgroundDetails: List<BackgroundResponse>? = index.urls?.let{ urls ->
            urls.map{
                val detail = remote.getBackgroundDetail(it)
                detail
            }
        }

        return backgroundDetails?.map{
            it.toBackground()
        }

    }
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
