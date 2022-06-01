package com.ihfazh.ksatriamuslim.remote.data

import android.os.Parcelable
import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Keep
@Parcelize
data class BookStateResponse(
    @field:SerializedName("id")
    val id: Int,
    @field:SerializedName("book")
    val book: Int,
    @field:SerializedName("child")
    val child: Int,
    @field:SerializedName("is_gift_opened")
    val isGiftOpened: Boolean,
) : Parcelable