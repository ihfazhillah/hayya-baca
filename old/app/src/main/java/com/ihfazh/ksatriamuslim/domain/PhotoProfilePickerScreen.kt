package com.ihfazh.ksatriamuslim.domain

import androidx.paging.PagingData

data class PhotoProfilePickerScreen(
    val child: Children? = null,
    val selectedPhoto: Picture? = null,
    val photos: PagingData<Picture>? = null,
    val isLoading: Boolean = false
) {
    fun isReady(): Boolean = child != null
}
