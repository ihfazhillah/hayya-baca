package com.ihfazh.ksatriamuslim.local.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index

@Entity(
    tableName = "book_ui",
    foreignKeys = [
        ForeignKey(
            entity = BookEntity::class,
            parentColumns = arrayOf("id"),
            childColumns = arrayOf("bookId")
        ),
        ForeignKey(
            entity = ChildEntity::class,
            parentColumns = arrayOf("id"),
            childColumns = arrayOf("childId")
        ),
    ],
    indices = [
        Index(value = ["bookId", "childId"])
    ],
    primaryKeys = ["bookId", "childId"]
)
data class BookUIEntity(
    val bookId: Int,
    val childId: Int,
    val gift_opened: Boolean,
)