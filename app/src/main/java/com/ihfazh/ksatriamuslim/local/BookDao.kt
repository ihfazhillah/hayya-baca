package com.ihfazh.ksatriamuslim.local

import androidx.paging.PagingSource
import androidx.room.*
import com.ihfazh.ksatriamuslim.local.data.BookEntity
import com.ihfazh.ksatriamuslim.local.data.BookPageEntity
import com.ihfazh.ksatriamuslim.local.data.BookUIEntity
import com.ihfazh.ksatriamuslim.local.data.BookWithBookUI

@Dao
abstract class BookDao {
    @Query("select * FROM book")
    abstract suspend fun getAll(): List<BookEntity>

    @Query("select * from book")
    abstract fun getAllPaginatedBook(): PagingSource<Int, BookEntity>

    @Query("delete from book")
    abstract suspend fun clearAllBook()

    @Query(
        "select b.id, b.title, b.thumbnailSrc, b.locallyCreated, ui.gift_opened from book b " +
                "join book_ui ui on ui.bookId = b.id " +
                "where ui.childId = :childId"
    )
    abstract fun getAllBookUI(childId: Int): PagingSource<Int, BookWithBookUI>

    @Query("select * from book_page where book_id = :bookId and `order` = :page")
    abstract suspend fun getPage(bookId: Int, page: Int): BookPageEntity?

    @Query("select * FROM book where id = :id")
    abstract suspend fun getById(id: Int): BookEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insert(book: BookEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insertAll(books: List<BookEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insertAllPages(bookPage: List<BookPageEntity>)

    // BOOK UIS
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insertBookUI(bookUI: BookUIEntity): Long

    @Update
    abstract suspend fun updateBookUI(bookUI: BookUIEntity): Int

    @Transaction
    open suspend fun insertOrUpdateBookUI(bookUI: BookUIEntity) {
        insertBookUI(bookUI)
//        getBooKUI(bookUI.bookId, bookUI.childId)?.let{
//            updateBookUI(it)
//        } ?: insertBookUI(bookUI)
//        val insertId = insertBookUI(bookUI)
//        if (insertId == -1L){
//            updateBookUI(bookUI = bookUI)
//        }
    }

    @Query("select * from book_ui where bookId = :bookId and childId = :childId")
    abstract suspend fun getBooKUI(bookId: Int, childId: Int): BookUIEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insertAllBookUI(booksUI: List<BookUIEntity>)

    @Update
    abstract suspend fun updateAllBookUI(booksUI: List<BookUIEntity>)


//    @Query
//    @Transaction
//    fun insertOrUpdateAllBookUI(booksUI: List<BookUIEntity>){

//    @Query("update book set gift_opened = 1 where id = :id")
//    suspend fun openGift(id: String)
}