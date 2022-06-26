package com.ihfazh.ksatriamuslim.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.local.data.ChildEntity
import com.ihfazh.ksatriamuslim.local.data.ChildWithPicture
import com.ihfazh.ksatriamuslim.local.data.ProfilePictureEntity

@Dao
interface ChildDao {
    @Query(
        """
        select c.id, c.coin, c.star, c.name, c.enableReadToMe, c.parentId, pp.photo as picture from child c
        left join profile_picture pp on pp.id = c.pictureId
    """
    )
    suspend fun getAll(): List<ChildWithPicture>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(background: ChildEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(backgrounds: List<ChildEntity>)

    @Query("select * from child where id = :id")
    suspend fun getChild(id: String): Children

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProfilePicture(profilePicture: ProfilePictureEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProfilePictures(profilePicture: List<ProfilePictureEntity>)

}