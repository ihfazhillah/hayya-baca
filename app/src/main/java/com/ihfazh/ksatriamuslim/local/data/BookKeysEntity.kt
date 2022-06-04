package com.ihfazh.ksatriamuslim.local.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "book_keys")
data class BookKeysEntity(
    @PrimaryKey val bookId: Int,
    val previousKey: Int?,
    val nextKey: Int?
)