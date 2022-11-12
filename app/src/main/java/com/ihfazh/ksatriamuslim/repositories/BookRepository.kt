package com.ihfazh.ksatriamuslim.repositories

import androidx.paging.PagingData
import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookPage
import com.ihfazh.ksatriamuslim.domain.BookPageCount
import com.ihfazh.ksatriamuslim.domain.BookUI
import kotlinx.coroutines.flow.Flow

interface BookRepository {
    suspend fun getBooksSummary(): List<BookUI> // remote -> local
    fun getPagedBooksSummary(childId: Int): Flow<PagingData<BookUI>>
    suspend fun refreshBooksUI(): List<BookUI>
    suspend fun getBook(bookId: Int): Book? // local
    suspend fun getPage(bookId: Int, page: Int): BookPage?
    suspend fun getPageCount(bookId: Int): Int
    suspend fun hasNext(bookId: Int, page: Int): Boolean
    suspend fun hasPrev(bookId: Int, page: Int): Boolean
    suspend fun openGift(bookId: Int)
    suspend fun logBook(bookId: Int)
    suspend fun logBookFinish(bookId: Int)
    suspend fun getBooksAndPageCount(): List<BookPageCount>
    suspend fun getBookAndPageCount(bookId: Int): BookPageCount
}