package com.ihfazh.ksatriamuslim.local

import androidx.paging.PagingSource
import androidx.room.*
import com.ihfazh.ksatriamuslim.local.data.SelectedApplicationEntity

@Dao
interface ApplicationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(apps: List<SelectedApplicationEntity>)

    @Delete
    suspend fun delete(app: SelectedApplicationEntity)

    @Query("select * from selected_application")
    fun getPaginatedApps(): PagingSource<Int, SelectedApplicationEntity>

    @Query("select * from selected_application")
    suspend fun getApps(): List<SelectedApplicationEntity>
}