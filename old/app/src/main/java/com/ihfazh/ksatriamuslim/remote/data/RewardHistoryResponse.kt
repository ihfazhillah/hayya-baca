package com.ihfazh.ksatriamuslim.remote.data

import android.os.Parcelable
import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Keep
@Parcelize
data class RewardHistoryResponse(
    @field:SerializedName("reward_type")
    val rewardType: String,
    @field:SerializedName("description")
    val description: String,
    @field:SerializedName("count")
    val count: Int,
    @field:SerializedName("child")
    val child: Int,
) : Parcelable