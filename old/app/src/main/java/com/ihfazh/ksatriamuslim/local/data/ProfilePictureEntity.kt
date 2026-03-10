package com.ihfazh.ksatriamuslim.local.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "profile_picture")
data class ProfilePictureEntity(
    @PrimaryKey
    val id: Int,
    val photo: String
)
