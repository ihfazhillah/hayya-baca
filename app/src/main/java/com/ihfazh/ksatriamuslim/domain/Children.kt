package com.ihfazh.ksatriamuslim.domain

data class Children(
    val id: String,
    val name: String,
    val coin: Long?,
    val star: Long?,
    val enableReadToMe: Boolean = false
)
