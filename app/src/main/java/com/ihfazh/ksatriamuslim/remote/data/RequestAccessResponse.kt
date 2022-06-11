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
    val message: String
) : Parcelable