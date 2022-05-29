package com.ihfazh.ksatriamuslim.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Update
import com.ihfazh.ksatriamuslim.local.data.RewardHistoryEntity

@Dao
interface RewardHistoryDao {
    //    @Query("select * FROM book")
//    suspend fun getAll(): List<BookSummaryEntity>
//
//    @Query("select * FROM book where id = :id")
//    suspend fun getById(id: String): BookEntity?
//
//    @Insert(onConflict = OnConflictStrategy.REPLACE)
//    suspend fun insert(book: BookEntity)
//
//    @Insert(onConflict = OnConflictStrategy.REPLACE)
//    suspend fun insertAll(books: List<BookEntity>)
//
//    @Query("update book set gift_opened = 1 where id = :id")
//    suspend fun openGift(id: String)
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(rewardHistory: RewardHistoryEntity)

    @Update
    suspend fun update(rewardHistory: RewardHistoryEntity)
}