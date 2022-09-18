package com.ihfazh.ksatriamuslim.domain

import android.graphics.Rect

data class Word(
    val text: String,
    val bboxes: List<Rect>
)

data class BookMetadata(
    val page_data: List<Word>
)
