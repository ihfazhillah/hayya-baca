package com.ihfazh.ksatriamuslim.local.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

data class BookSummaryEntity (
    val id: String,
    val title: String,
    val thumbnailSrc: String,
)