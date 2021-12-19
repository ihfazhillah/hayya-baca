package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookSummary
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.local.data.BookEntity
import com.ihfazh.ksatriamuslim.local.data.BookSummaryEntity
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimService
import com.ihfazh.ksatriamuslim.remote.data.BookDetailResponse

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
}

private fun BookEntity.toBook(): Book {
    return Book(id, pages.split("+=+=+"))
}

private fun BookDetailResponse.toBookSummary(): BookSummary {
    val id = title.lowercase().replace(" ", "-")

    return BookSummary(
        id, title, thumbnail
    )

}

private fun BookDetailResponse.toBookEntity(): BookEntity {
    val pages = content.map{
        it.pageText
    }
        .joinToString("+=+=+")
    val id = title.lowercase().replace(" ", "-")
    return BookEntity(
        id, title, thumbnail, pages
    )
}

private fun List<BookSummaryEntity>.toBookSummaries(): List<BookSummary> =
    map {
        BookSummary(it.id, it.title, it.thumbnailSrc)
    }
