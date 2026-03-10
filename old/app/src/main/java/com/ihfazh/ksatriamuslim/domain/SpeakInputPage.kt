package com.ihfazh.ksatriamuslim.domain

data class SpeakInputPage(
    val book: Int,
    val page: Int,

    // text in a page. Used for fallback into
    // tts service
    val text: String,
)