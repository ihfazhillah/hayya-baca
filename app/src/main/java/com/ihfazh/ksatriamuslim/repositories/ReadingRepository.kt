package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Background

interface ReadingRepository {
    suspend fun getText(bookId: String, page: Int): String
    suspend fun hasNext(bookId: String, page: Int): Boolean
    suspend fun hasPrev(bookId: String, page: Int): Boolean
    suspend fun getBackground(): Background
}