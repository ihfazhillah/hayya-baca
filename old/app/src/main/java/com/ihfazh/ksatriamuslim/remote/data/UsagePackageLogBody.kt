package com.ihfazh.ksatriamuslim.remote.data

import android.os.Parcelable
import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Keep
@Parcelize
data class UsagePackageLogBody(
    @field:SerializedName("package")
    val pkg: String,
    @field:SerializedName("child")
    val child: Int,
    @field:SerializedName("finished_at")
    val finishedAt: String? = null,
    @field:SerializedName("started_at")
    val startedAt: String? = null,
) : Parcelable