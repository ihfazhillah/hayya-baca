package com.ihfazh.ksatriamuslim.local.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "book")
data class BookEntity(
    @PrimaryKey val id: Int,
    @ColumnInfo(name = "title") val title: String,
    @ColumnInfo(name = "thumbnailSrc") val thumbnailSrc: String,

    @ColumnInfo(name = "locallyCreated", defaultValue = "0")
    val created: Int,
)