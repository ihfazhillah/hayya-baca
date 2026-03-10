package com.ihfazh.ksatriamuslim.remote.data

import android.os.Parcelable
import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Keep
@Parcelize
data class RequestAccessBody(
    @field:SerializedName("count")
    val count: Int,
    @field:SerializedName("message")
    val message: String,
    @field:SerializedName("child_id")
    val child_id: Int,
) : Parcelable