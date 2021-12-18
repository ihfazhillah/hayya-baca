package com.ihfazh.ksatriamuslim.repositories

interface ReadingRepository {
    suspend fun getText(page: Int): String
    suspend fun hasNext(page: Int): Boolean
    suspend fun hasPrev(page: Int): Boolean
}