package com.ihfazh.ksatriamuslim.remote.data

import android.os.Parcelable
import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Keep
@Parcelize
data class RequestAccessResponse(
    @field:SerializedName("permissible")
    val permissible: Boolean,
    @field:SerializedName("message")
    val message: String,
    @field:SerializedName("coin_remaining")
    val coinRemaining: Int?,
    @field:SerializedName("duration_remaining")
    val durationRemaining: Float?,
) : Parcelable