package com.ihfazh.ksatriamuslim.domain

import android.graphics.RectF
import androidx.annotation.Keep

@Keep
data class Word(
    val text: String,
    val bboxes: List<RectF>
)

@Keep
data class BookMetadata(
    val page_data: List<Word>
)
