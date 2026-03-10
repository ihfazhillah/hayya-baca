package com.ihfazh.ksatriamuslim.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ihfazh.ksatriamuslim.local.data.BookKeysEntity

@Dao
interface BookKeysDao {
    @Query("select * from book_keys where bookId = :bookId")
    suspend fun getBookKeysById(bookId: Int): BookKeysEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertKeys(keys: List<BookKeysEntity>)

    @Query("delete from book_keys")
    suspend fun deleteAllBookKeys()
}