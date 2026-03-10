package com.ihfazh.ksatriamuslim.domain

data class WordPage(
    val text: String,
    val startPos: Int,
    val endPos: Int,
    val isRead: Boolean = false
)
