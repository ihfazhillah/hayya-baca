package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookSummary
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimService
import com.ihfazh.ksatriamuslim.toBook
import com.ihfazh.ksatriamuslim.toBookEntity
import com.ihfazh.ksatriamuslim.toBookSummaries
import com.ihfazh.ksatriamuslim.toBookSummary

class BookRepositoryImpl(
    private val local: AppDatabase,
    private val remote: KsatriaMuslimService
): BookRepository {
    override suspend fun getBooksSummary(): List<BookSummary> {
        val localBooks = local.bookDao().getAll()
        if (localBooks.isEmpty()){
            val indexBooks = remote.getBooks()

            val bookSummaries = indexBooks.urls?.map {  url ->
                val detailBook = remote.getBookDetail(url)

                // cache to db
                val bookEntity = detailBook.toBookEntity()
                local.bookDao().insert(bookEntity)

                val summaryBook: BookSummary = detailBook.toBookSummary()
                summaryBook
            } ?: emptyList()

            return bookSummaries
        }

        return localBooks.toBookSummaries()
    }

    override suspend fun getBook(id: String): Book {
        return local.bookDao().getById(id).toBook()
    }

    override suspend fun getPage(id: String, page: Int): String {
        val book = getBook(id)
        return book.pages[page - 1]
    }

    override suspend fun hasNext(id: String, page: Int): Boolean {
        val book = getBook(id)
        return page < book.pages.size
    }

    override suspend fun hasPrev(id: String, page: Int): Boolean {
        return page > 1
    }
}

