package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookPage
import com.ihfazh.ksatriamuslim.domain.BookUI

interface BookRepository {
    suspend fun getBooksSummary(): List<BookUI> // remote -> local
    suspend fun getBook(bookId: Int): Book? // local
    suspend fun getPage(bookId: Int, page: Int): BookPage?
    suspend fun hasNext(bookId: Int, page: Int): Boolean
    suspend fun hasPrev(bookId: Int, page: Int): Boolean
    suspend fun openGift(bookId: Int)
}