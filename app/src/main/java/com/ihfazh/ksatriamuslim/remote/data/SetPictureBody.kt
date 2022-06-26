package com.ihfazh.ksatriamuslim.remote.data

import android.os.Parcelable
import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Keep
@Parcelize
data class SetPictureBody(
    @field:SerializedName("picture_id")
    val picture_id: Int,
) : Parcelable