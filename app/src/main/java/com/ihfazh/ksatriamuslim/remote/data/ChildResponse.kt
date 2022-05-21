package com.ihfazh.ksatriamuslim.remote.data

import com.google.gson.annotations.SerializedName

data class ChildResponse(

    @field:SerializedName("id")
    val id: String,

    @field:SerializedName("enable_read_to_me")
    val enableReadToMe: Boolean,

    @field:SerializedName("name")
    val name: String,

    @field:SerializedName("stars")
    val stars: Int,

    @field:SerializedName("points")
    val points: Int,

    @field:SerializedName("parent_id")
    val parentId: String
)
