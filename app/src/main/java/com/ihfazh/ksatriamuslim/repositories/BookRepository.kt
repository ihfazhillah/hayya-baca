package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookSummary

interface BookRepository {
    suspend fun getBooksSummary(forceFetch: Boolean = false): List<BookSummary>
    suspend fun getBook(id: String): Book
    suspend fun getPage(id: String, page: Int): String?
    suspend fun hasNext(id: String, page: Int): Boolean
    suspend fun hasPrev(id: String, page: Int): Boolean
}