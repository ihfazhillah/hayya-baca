package com.ihfazh.ksatriamuslim.domain

import java.util.*

data class Book(
    val id: String,
    val pages: List<String>,
    var locallyCreatedDate: Date,
    var isGiftOpened: Boolean = true,
)