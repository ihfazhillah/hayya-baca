package com.ihfazh.ksatriamuslim.remote.data

import android.os.Parcelable
import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Keep
@Parcelize
data class UpdateBookStateResponse(
    @field:SerializedName("status")
    val rewardType: String,
) : Parcelable