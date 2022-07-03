package com.ihfazh.ksatriamuslim.local.data

data class BookWithBookUI(
    val id: Int,
    val title: String,
    val thumbnailSrc: String,
    val locallyCreated: Int,
    val gift_opened: Boolean,
    val locked: Boolean
)
