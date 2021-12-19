package com.ihfazh.ksatriamuslim.local.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "book")
data class BookEntity (
    @PrimaryKey val id: String,
    @ColumnInfo(name = "title") val title: String,
    @ColumnInfo(name = "thumbnailSrc") val thumbnailSrc: String,

    // for now save as string using separator =+=+=+
    @ColumnInfo(name = "pages") val pages: String,
)