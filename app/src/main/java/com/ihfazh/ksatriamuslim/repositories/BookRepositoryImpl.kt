package com.ihfazh.ksatriamuslim.repositories

//import com.ihfazh.ksatriamuslim.toBookEntity
//import com.ihfazh.ksatriamuslim.toBookSummaries
//import com.ihfazh.ksatriamuslim.toBookSummary
import androidx.paging.*
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookPage
import com.ihfazh.ksatriamuslim.domain.BookUI
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.local.data.BookEntity
import com.ihfazh.ksatriamuslim.local.data.BookPageEntity
import com.ihfazh.ksatriamuslim.local.data.BookUIEntity
import com.ihfazh.ksatriamuslim.remote.BookRemoteMediator
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimBackendService
import com.ihfazh.ksatriamuslim.remote.data.BookItem
import com.ihfazh.ksatriamuslim.remote.data.BookStateResponse
import com.ihfazh.ksatriamuslim.remote.data.PageBookResponse
import com.ihfazh.ksatriamuslim.remote.data.UpdateBookStateBody
import com.ihfazh.ksatriamuslim.toBook
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.koin.core.annotation.Factory

@Factory
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
        // update books ui from server

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

    @OptIn(ExperimentalPagingApi::class)
    override fun getPagedBooksSummary(childId: Int): Flow<PagingData<BookUI>> {
        val config = PagingConfig(pageSize = 15)
        val pagingMediator = BookRemoteMediator(
            db = local,
            remote = remote,
            childId
        )
        return Pager(
            config = config,
            remoteMediator = pagingMediator,
            pagingSourceFactory = {
                local.bookDao().getAllBookUI(childId)
            }
        ).flow.map { pagingData ->
            pagingData.map {
                BookUI(
                    Book(it.id, it.title, it.thumbnailSrc, it.locallyCreated),
                    it.gift_opened, it.locked
                )
            }

        }
    }

    override suspend fun refreshBooksUI(): List<BookUI> {
        val booksId = local.bookDao().getAll().map { it.id }
        val remoteBooksUI = remote.getBooksState(booksId, getChildId()?.toInt()).body()
        remoteBooksUI?.map { it.toBookUIEntity() }?.forEach {
            local.bookDao().insertOrUpdateBookUI(it)
        }
        return local.bookDao().getAll().map { bookEntity: BookEntity ->
            val ui = local.bookDao().getBooKUI(bookEntity.id, getChildId()!!.toInt())
            bookEntity.toBookSummaries(ui)
        }
    }

    override suspend fun getBook(id: Int): Book? {

        val remoteBook = remote.getBook(id).body()
        if (remoteBook != null) {
            local.bookDao().insert(remoteBook.toBookEntity())
            // make sure delete first all
            local.bookDao().deleteAllPages(remoteBook.id)
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

    override suspend fun getPageCount(bookId: Int): Int {
        return local.bookDao().getPageCount(bookId)
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
        getChildId()?.let { childId ->
            local.bookDao().insertOrUpdateBookUI(
                BookUIEntity(id, childId.toInt(), true)
            )
            remote.updateBookState(
                id,
                UpdateBookStateBody(childId.toInt(), true)
            )
        }
    }
}

private fun BookStateResponse.toBookUIEntity(): BookUIEntity {
    return BookUIEntity(
        bookId = book,
        childId = child,
        gift_opened = isGiftOpened
    )
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
        gift_opened = ui?.gift_opened ?: false,
        locked = ui?.locked ?: false
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

