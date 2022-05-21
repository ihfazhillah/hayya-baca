package com.ihfazh.ksatriamuslim.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.local.data.ChildEntity

@Dao
interface ChildDao {
    @Query("select * FROM child")
    suspend fun getAll(): List<ChildEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(background: ChildEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(backgrounds: List<ChildEntity>)

    @Query("select * from child where id = :id")
    suspend fun getChild(id: String): Children

}