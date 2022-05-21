package com.ihfazh.ksatriamuslim.remote.data

import android.os.Parcelable
import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Keep
@Parcelize
data class LoginBody(

    @field:SerializedName("email")
    val email: String,
    @field:SerializedName("password")
    val password: String,

    ) : Parcelable