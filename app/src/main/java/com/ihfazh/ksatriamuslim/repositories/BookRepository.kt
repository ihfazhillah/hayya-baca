package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookSummary

interface BookRepository {
    suspend fun getBooksSummary(): List<BookSummary>
    suspend fun getBook(id: String): Book
}