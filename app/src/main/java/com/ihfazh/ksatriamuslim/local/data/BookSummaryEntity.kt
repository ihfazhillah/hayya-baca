package com.ihfazh.ksatriamuslim.local.data

import java.util.*

data class BookSummaryEntity(
    val id: String,
    val title: String,
    val thumbnailSrc: String,
    val locallyCreated: Date,
    val gift_opened: Boolean
)