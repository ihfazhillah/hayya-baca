package com.ihfazh.ksatriamuslim.repositories

interface ReadingRepository {
    suspend fun getText(bookId: String, page: Int): String
    suspend fun hasNext(bookId: String, page: Int): Boolean
    suspend fun hasPrev(bookId: String, page: Int): Boolean
}