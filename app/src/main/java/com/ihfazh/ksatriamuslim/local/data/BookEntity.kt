package com.ihfazh.ksatriamuslim.local.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.*

@Entity(tableName = "book")
data class BookEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "title") val title: String,
    @ColumnInfo(name = "thumbnailSrc") val thumbnailSrc: String,

    // for now save as string using separator =+=+=+
    @ColumnInfo(name = "pages") val pages: String,

    @ColumnInfo(name = "locallyCreated", defaultValue = "0")
    var locallyCreated: Date = Date(),

    // to handle animation
    // TODO: if we already implement user accounts we need to swap these into
    // another field
    @ColumnInfo(name = "gift_opened", defaultValue = "1") var gift_opened: Boolean = true,

    )