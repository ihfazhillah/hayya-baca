package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Book

interface HomeRepository {
    suspend fun getBooks(): List<Book>
}