package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.ihfazh.ksatriamuslim.repositories.AuthenticationRepository

@Suppress("UNCHECKED_CAST")
class AuthViewModelFactory(private val repo: AuthenticationRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return AuthViewModel(repo) as T
    }
}