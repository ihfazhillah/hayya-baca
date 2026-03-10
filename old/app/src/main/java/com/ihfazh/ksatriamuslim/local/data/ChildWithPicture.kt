package com.ihfazh.ksatriamuslim.local.data

data class ChildWithPicture(
    val id: String,
    val name: String,
    val star: Long,
    val coin: Long,
    val enableReadToMe: Boolean = false,
    val parentId: String? = null,
    val picture: String? = null,
    val pictureId: Int? = null
)
