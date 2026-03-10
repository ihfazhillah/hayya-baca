package com.ihfazh.ksatriamuslim.local.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "profile_picture_keys")
data class ProfilePictureKeyEntity(
    @PrimaryKey val profilePictureId: Int,
    val previousKey: Int?,
    val nextKey: Int?
)