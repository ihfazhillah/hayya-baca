package com.ihfazh.ksatriamuslim.local.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "background")
data class BackgroundEntity (
    @PrimaryKey val id: String,
    @ColumnInfo(name = "title") val title: String,
    @ColumnInfo(name = "src") val src: String,
    @ColumnInfo(name = "text_color") val text_color: String,
)