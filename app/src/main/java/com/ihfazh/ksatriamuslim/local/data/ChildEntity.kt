package com.ihfazh.ksatriamuslim.local.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "child")
data class ChildEntity(
    @PrimaryKey
    val id: String,
    val name: String,
    val star: Long,
    val coin: Long,
    val enableReadToMe: Boolean = false,
    val parentId: String? = null,
    val pictureId: Int? = null,
    val defaultPackageName: String? = null
)
