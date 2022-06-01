package com.ihfazh.ksatriamuslim.repositories

//import com.ihfazh.ksatriamuslim.toBookEntity
//import com.ihfazh.ksatriamuslim.toBookSummaries
//import com.ihfazh.ksatriamuslim.toBookSummary
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookPage
import com.ihfazh.ksatriamuslim.domain.BookUI
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.local.data.BookEntity
import com.ihfazh.ksatriamuslim.local.data.BookPageEntity
import com.ihfazh.ksatriamuslim.local.data.BookUIEntity
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimBackendService
import com.ihfazh.ksatriamuslim.remote.data.BookItem
import com.ihfazh.ksatriamuslim.remote.data.PageBookResponse
import com.ihfazh.ksatriamuslim.toBook

class BookRepositoryImpl(
    private val local: AppDatabase,
    private val remote: KsatriaMuslimBackendService,
    private val sessionManager: SessionManager
): BookRepository {
    private fun getChildId(): String? {
        return sessionManager.getSelectedChild()
    }

    override suspend fun getBooksSummary(): List<BookUI> {
        val localBooks = local.bookDao().getAll()

        val booksFromRemote = remote.getBooks().body()
        if (booksFromRemote !== null) {
            local.bookDao().insertAll(
                booksFromRemote.results.map {
                    it.toBookEntity()
                }
            )

            return local.bookDao().getAll().map { bookEntity: BookEntity ->
                val ui = local.bookDao().getBooKUI(bookEntity.id, getChildId()!!.toInt())
                bookEntity.toBookSummaries(ui)
            }
        }

        return localBooks.map { bookEntity: BookEntity ->
            val ui = local.bookDao().getBooKUI(bookEntity.id, getChildId()!!.toInt())
            bookEntity.toBookSummaries(ui)
        }
    }

    override suspend fun getBook(id: Int): Book? {

        val remoteBook = remote.getBook(id).body()
        if (remoteBook != null) {
            local.bookDao().insert(remoteBook.toBookEntity())
            local.bookDao().insertAllPages(
                remoteBook.page_set.map {
                    it.toEntity(remoteBook.id)
                }
            )
//            local.bookDao().insertPages(remoteBook.page_set)
        }

        return local.bookDao().getById(id)?.toBook()
    }

    override suspend fun getPage(id: Int, page: Int): BookPage? {
        return local.bookDao().getPage(id, page)?.toDomain()
    }

    override suspend fun hasNext(id: Int, page: Int): Boolean {
        val nextPage = getPage(id, page + 1)
        return nextPage !== null
    }

    override suspend fun hasPrev(id: Int, page: Int): Boolean {
        val prevPage = getPage(id, page - 1)
        return prevPage !== null
    }

    override suspend fun openGift(id: Int) {
//        local.bookDao().openGift(id)
    }
}

private fun PageBookResponse.toEntity(bookId: Int): BookPageEntity {
    return BookPageEntity(
        id = id.toString(),
        order = page,
        bookId = bookId.toString(),
        audio = audio,
        text = text
    )
}

private fun BookPageEntity.toDomain(): BookPage {
    return BookPage(id, order = order, text = text, audio = audio)
}

private fun BookEntity.toBookSummaries(ui: BookUIEntity?): BookUI {
    val book = Book(
        id = id,
        title = title,
        thumbnailSrc = thumbnailSrc,
        created = created
    )
    return BookUI(
        book = book,
//        gift_opened = ui?.gift_opened ?: false
        gift_opened = true
    )
}

private fun BookItem.toBookEntity(): BookEntity {
    return BookEntity(
        id = id,
        title = title,
        thumbnailSrc = cover,
        created = 0
    )
}

