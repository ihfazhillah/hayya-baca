package com.ihfazh.ksatriamuslim.domain

data class Picture(
    val id: Int,
    val photo: String
)

data class Children(
    val id: String,
    val name: String,
    val coin: Long?,
    val star: Long?,
    val enableReadToMe: Boolean = false,
    val picture: String? = null,
    val pictureId: Int? = null,
    val defaultPackageName: String? = null
)
