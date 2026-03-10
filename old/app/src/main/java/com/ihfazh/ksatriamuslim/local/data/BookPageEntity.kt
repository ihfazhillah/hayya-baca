package com.ihfazh.ksatriamuslim.local.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.PrimaryKey

@Entity(
    tableName = "book_page",
    foreignKeys = [ForeignKey(
        entity = BookEntity::class,
        parentColumns = arrayOf("id"),
        childColumns = arrayOf("book_id"),
        onDelete = ForeignKey.CASCADE
    )]
)
data class BookPageEntity(
    @PrimaryKey val id: String,

    @ColumnInfo(name = "book_id") val bookId: String,


    @ColumnInfo(name = "order") val order: Int,
    @ColumnInfo(name = "text") val text: String,

    @ColumnInfo(name = "audio") val audio: String?,
)