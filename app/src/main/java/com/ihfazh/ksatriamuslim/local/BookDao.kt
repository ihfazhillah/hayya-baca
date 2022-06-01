package com.ihfazh.ksatriamuslim.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ihfazh.ksatriamuslim.local.data.BookEntity
import com.ihfazh.ksatriamuslim.local.data.BookPageEntity
import com.ihfazh.ksatriamuslim.local.data.BookUIEntity

@Dao
interface BookDao {
    @Query("select * FROM book")
    suspend fun getAll(): List<BookEntity>

    @Query("select * from book_ui where bookId = :bookId and childId = :childId")
    suspend fun getBooKUI(bookId: Int, childId: Int): BookUIEntity?

    @Query("select * from book_page where book_id = :bookId and `order` = :page")
    suspend fun getPage(bookId: Int, page: Int): BookPageEntity?

    @Query("select * FROM book where id = :id")
    suspend fun getById(id: Int): BookEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(book: BookEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(books: List<BookEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAllPages(bookPage: List<BookPageEntity>)

//    @Query("update book set gift_opened = 1 where id = :id")
//    suspend fun openGift(id: String)
}