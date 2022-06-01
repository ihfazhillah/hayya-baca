package com.ihfazh.ksatriamuslim.remote.data

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class UpdateBookStateBody(
    @field:SerializedName("child_id")
    val childId: Int,
    @field:SerializedName("gift_opened")
    val giftOpened: Boolean = false,
) : Parcelable