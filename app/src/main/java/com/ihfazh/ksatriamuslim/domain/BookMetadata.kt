package com.ihfazh.ksatriamuslim.domain

import android.graphics.Rect
import androidx.annotation.Keep

@Keep
data class Word(
    val text: String,
    val bboxes: List<Rect>
)

@Keep
data class BookMetadata(
    val page_data: List<Word>
)
