package com.ihfazh.ksatriamuslim.remote

import android.util.Log
import androidx.paging.ExperimentalPagingApi
import androidx.paging.LoadType
import androidx.paging.PagingState
import androidx.paging.RemoteMediator
import androidx.room.withTransaction
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.local.data.BookEntity
import com.ihfazh.ksatriamuslim.local.data.BookKeysEntity
import com.ihfazh.ksatriamuslim.local.data.BookUIEntity
import com.ihfazh.ksatriamuslim.local.data.BookWithBookUI
import com.ihfazh.ksatriamuslim.remote.data.BookItem
import java.io.InvalidObjectException


@OptIn(ExperimentalPagingApi::class)
class BookRemoteMediator(
    private val db: AppDatabase,
    private val remote: KsatriaMuslimBackendService,
    private val childId: Int
) : RemoteMediator<Int, BookWithBookUI>() {
    override suspend fun load(
        loadType: LoadType,
        state: PagingState<Int, BookWithBookUI>
    ): MediatorResult {
        val page = when (loadType) {
            LoadType.REFRESH -> {
                val keys = loadKeysForClosetsBook(state)
                keys?.nextKey ?: startingPageIndex
            }
            LoadType.APPEND -> {
                val keys = loadKeysForLastBook(state)
                keys?.nextKey ?: return MediatorResult.Success(endOfPaginationReached = false)
            }
            LoadType.PREPEND -> {
                val keys = loadKeysForFirstBook(state) ?: return MediatorResult.Error(
                    InvalidObjectException("keys should not be null for $loadType")
                )
                keys.previousKey ?: return MediatorResult.Success(endOfPaginationReached = true)
            }
        }
        return loadAndSaveApiData(page, state, loadType == LoadType.REFRESH)
    }

    private suspend fun loadKeysForFirstBook(state: PagingState<Int, BookWithBookUI>): BookKeysEntity? {
        return state.pages.firstOrNull { it.data.isNotEmpty() }
            ?.data?.firstOrNull()?.let { book ->
                db.bookKeysDao().getBookKeysById(book.id)
            }
    }

    private suspend fun loadKeysForLastBook(state: PagingState<Int, BookWithBookUI>): BookKeysEntity? {
        return state.pages.lastOrNull { it.data.isNotEmpty() }
            ?.data?.lastOrNull()?.let { book ->
                db.bookKeysDao()
                    .getBookKeysById(book.id)
            }

    }

    private suspend fun loadKeysForClosetsBook(state: PagingState<Int, BookWithBookUI>): BookKeysEntity? {
        return state.anchorPosition?.let { pos ->
            state.closestItemToPosition(pos)?.id?.let { bookId ->
                db.bookKeysDao().getBookKeysById(bookId)
            }
        }
    }


    private suspend fun loadAndSaveApiData(
        page: Int,
        state: PagingState<Int, BookWithBookUI>,
        isRefresh: Boolean
    ): MediatorResult {
        return try {
            val apiResponse = remote.getBooks(page, state.config.pageSize)

            val books = apiResponse.body()?.results?.convertToBook()
            val endOfPaginationReached = apiResponse.body()?.next == null

            Log.d(TAG, "loadAndSaveApiData: page $page")
            Log.d(TAG, "loadAndSaveApiData: $books")

            db.withTransaction {
                if (isRefresh) {
                    db.bookKeysDao().deleteAllBookKeys()
//                    db.bookDao().clearAllBook()
                }

                val previousKey = if (page == startingPageIndex) null else page - 1
                val nextKey = if (endOfPaginationReached) null else page + 1

                books?.let { books ->
                    val keys = books.map { book ->
                        BookKeysEntity(book.id, previousKey, nextKey)
                    }
                    db.bookKeysDao().insertKeys(keys)
                    db.bookDao().insertAll(
                        books
                    )

                    // update books ui
                    val booksId = books.map { it.id }
                    val uiResponse = remote.getBooksState(booksId, childId)
                    if (uiResponse.isSuccessful) {
                        uiResponse.body()!!.map {
                            BookUIEntity(it.book, it.child, it.isGiftOpened, it.locked)
                        }.also {
                            db.bookDao().insertAllBookUI(it)
                        }

                    }
                }
            }
            MediatorResult.Success(endOfPaginationReached = endOfPaginationReached)
        } catch (ex: Exception) {
            Log.e(TAG, "loadAndSaveApiData: got paging error here", ex)
            MediatorResult.Error(ex)
        }
    }

    companion object {
        const val startingPageIndex = 1
        private val TAG = BookRemoteMediator::class.java.simpleName
    }
}

private fun List<BookItem>.convertToBook(): List<BookEntity> {
    return map {
        it.convertToBook()
    }
}

private fun BookItem.convertToBook(): BookEntity {
    return BookEntity(
        id = id,
        title = title,
        thumbnailSrc = cover,
        created = 0
    )
}
