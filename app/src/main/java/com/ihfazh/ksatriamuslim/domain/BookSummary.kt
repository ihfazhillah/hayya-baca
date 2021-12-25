package com.ihfazh.ksatriamuslim.domain

import java.util.*

data class BookSummary(
    val id: String,
    val title: String,
    val thumbnailSrc: String,
    val locallyCreated: Date? = null,
    val gift_opened: Boolean = true
)
