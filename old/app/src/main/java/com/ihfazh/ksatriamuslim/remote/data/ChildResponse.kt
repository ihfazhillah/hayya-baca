package com.ihfazh.ksatriamuslim.remote.data

import com.google.gson.annotations.SerializedName


data class ProfilePicture(
    @field:SerializedName("id")
    val id: Int,

    @field:SerializedName("photo")
    val photo: String
)

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
    val parentId: String,

    @field:SerializedName("picture")
    val picture: ProfilePicture? = null,

    @field:SerializedName("default_package_name")
    val defaultPackageName: String?
)
