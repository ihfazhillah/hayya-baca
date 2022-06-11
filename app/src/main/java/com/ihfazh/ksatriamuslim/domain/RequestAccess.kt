package com.ihfazh.ksatriamuslim.domain

data class RequestAccess(
    val permissible: Boolean,
    val message: String
) {
    fun getFullMessage() = when (message) {
        "can_access" -> "Bisa Akses"
        "not_parent" -> "Uh oh, you're not belong to your parent"
        "no_coin" -> "Uh oh, koin mu gak cukup"
        else -> "Unknown error"
    }
}
