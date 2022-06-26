package com.ihfazh.ksatriamuslim.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ihfazh.ksatriamuslim.local.data.ProfilePictureKeyEntity

@Dao
interface ProfilePictureKeyDao {
    @Query("select * from profile_picture_keys where profilePictureId = :bookId")
    suspend fun getPPKeysById(bookId: Int): ProfilePictureKeyEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertKeys(keys: List<ProfilePictureKeyEntity>)

    @Query("delete from profile_picture_keys")
    suspend fun deleteAllPPKeys()
}