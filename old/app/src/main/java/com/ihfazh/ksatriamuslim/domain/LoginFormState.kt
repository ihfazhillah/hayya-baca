package com.ihfazh.ksatriamuslim.domain

data class LoginFormState(
    val emailError: String? = null,
    val passwordError: String? = null,
    val nonFieldErrors: List<String>? = null,
    val isLoading: Boolean = false
)
