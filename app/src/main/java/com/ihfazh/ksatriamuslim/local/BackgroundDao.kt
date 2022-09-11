package com.ihfazh.ksatriamuslim.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ihfazh.ksatriamuslim.local.data.BackgroundEntity

@Dao
interface BackgroundDao {
    @Query("select * from background")
    suspend fun getAll(): List<BackgroundEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(background: BackgroundEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(backgrounds: List<BackgroundEntity>)
}