package com.ihfazh.ksatriamuslim.remote.data

import android.os.Parcelable
import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Keep
@Parcelize
data class LoginErrorResponse(
    @field:SerializedName("email")
    val email: List<String>?,
    @field:SerializedName("password")
    val password: List<String>?,
    @field:SerializedName("non_field_errors")
    val non_field_errors: List<String>?,

    ) : Parcelable