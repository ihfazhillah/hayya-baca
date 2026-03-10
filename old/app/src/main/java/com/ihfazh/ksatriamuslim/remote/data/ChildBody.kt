package com.ihfazh.ksatriamuslim.remote.data

import com.google.gson.annotations.SerializedName

data class ChildBody(
    @field:SerializedName("id")
    val id: String,

    @field:SerializedName("enable_read_to_me")
    val enableReadToMe: Boolean,

    @field:SerializedName("name")
    val name: String,
)
