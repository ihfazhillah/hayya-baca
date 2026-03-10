package com.ihfazh.ksatriamuslim.local

import android.util.Log
import androidx.paging.PagingSource
import androidx.room.*
import com.ihfazh.ksatriamuslim.domain.BookPageCount
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
//        "select b.id, b.title, b.thumbnailSrc, b.locallyCreated, ui.gift_opened from book b " +
//                "left join book_ui ui on ui.bookId = b.id " +
//                "where ui.childId = :childId or ui.childId is null " +
//                "order by id desc"
        """
        with book_child as (
select b.title, b.id, b.thumbnailSrc, b.locallyCreated, child.id childId from book b
cross join child
)

select b.title, b.id, b.thumbnailSrc, b.locallyCreated, ui.gift_opened, ui.locked from book_child b
left join book_ui ui on ui.bookId = b.id and ui.childId = b.childId
where b.childId = :childId
-- order by b.id desc
"""
    )
    abstract fun getAllBookUI(childId: Int): PagingSource<Int, BookWithBookUI>

    @Query("select * from book_page where book_id = :bookId and `order` = :page")
    abstract suspend fun getPage(bookId: Int, page: Int): BookPageEntity?

//    @Query("select * from book_page where book_id = :bookId order by `order`")
//    abstract suspend fun getPages(bookId: Int): List<BookPageEntity>

    @Query("select * FROM book where id = :id")
    abstract suspend fun getById(id: Int): BookEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insert(book: BookEntity)

    @Update
    abstract suspend fun updateBook(book: BookEntity)

    @Transaction
    open suspend fun updateOrCreate(book: BookEntity) {
        getById(book.id)?.let {
            updateBook(book)
        } ?: insert(book)
    }

    // ini bakal hapus dulu child yang ada
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insertAll(books: List<BookEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insertAllPages(bookPage: List<BookPageEntity>)

    @Query("delete from book_page where book_id = :bookId")
    abstract suspend fun deleteAllPages(bookId: Int)

    @Query("select count(*) from book_page where book_id =:bookId")
    abstract suspend fun getPageCount(bookId: Int): Int

    // BOOK UIS
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insertBookUI(bookUI: BookUIEntity): Long

    @Update
    abstract suspend fun updateBookUI(bookUI: BookUIEntity): Int

//    @Transaction
//    open suspend fun insertOrUpdateBookUI(bookUI: BookUIEntity) {
//        insertBookUI(bookUI)
////        getBooKUI(bookUI.bookId, bookUI.childId)?.let{
////            updateBookUI(it)
////        } ?: insertBookUI(bookUI)
////        val insertId = insertBookUI(bookUI)
////        if (insertId == -1L){
////            updateBookUI(bookUI = bookUI)
////        }
//    }

    @Query("select * from book_ui where bookId = :bookId and childId = :childId")
    abstract suspend fun getBooKUI(bookId: Int, childId: Int): BookUIEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    abstract suspend fun insertAllBookUI(booksUI: List<BookUIEntity>)

    @Update
    abstract suspend fun updateAllBookUI(booksUI: List<BookUIEntity>)

    @Transaction
    open suspend fun insertOrUpdateBookUI(bookUI: BookUIEntity) {
        Log.d("InsertOrUpdateBookUI", "insertOrUpdateBookUI: $bookUI")

        val result = getBooKUI(bookUI.bookId, bookUI.childId)?.let { ui ->
            Log.d("InsertOrUpdateBookUI", "got book ui, should update")
            updateBookUI(bookUI)
        } ?: insertBookUI(bookUI)

        Log.d("InsertOrUpdateBookUI", "insertOrUpdateBookUI: result: $result")
    }

    @Query(
        """
        select book.id, (select count(*) from book_page where book_page.book_id = book.id) as pageCount
        from book
      group by book.id
    """
    )
    abstract suspend fun getBooksAndPageCount(): List<BookPageCount>

    @Query(
        """
        select book.id, count(book_page.id) as pageCount 
        from book
        join book_page on book_page.book_id = book.id
        where book.id = :bookId
    """
    )
    abstract suspend fun getBookAndPageCount(bookId: Int): BookPageCount


//    @Query
//    @Transaction
//    fun insertOrUpdateAllBookUI(booksUI: List<BookUIEntity>){

//    @Query("update book set gift_opened = 1 where id = :id")
//    suspend fun openGift(id: String)
}