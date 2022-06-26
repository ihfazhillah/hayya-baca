package com.ihfazh.ksatriamuslim.remote.data

import com.google.gson.annotations.SerializedName

data class ProfilePictureListResponse(

    @field:SerializedName("next")
    val next: String? = null,

    @field:SerializedName("previous")
    val previous: String? = null,

    @field:SerializedName("count")
    val count: Int? = null,

    @field:SerializedName("results")
    val results: List<ProfilePictureItem>
)

data class ProfilePictureItem(

    @field:SerializedName("id")
    val id: Int,

    @field:SerializedName("photo")
    val photo: String,

    )
