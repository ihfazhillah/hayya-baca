package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepository
import com.ihfazh.ksatriamuslim.repositories.AuthenticationRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository

@Suppress("UNCHECKED_CAST")
class AuthViewModelFactory(private val repo: AuthenticationRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return AuthViewModel(repo) as T
    }
}

@Suppress("UNCHECKED_CAST")
class ChildFormViewModelFactory(private val repo: ChildrenRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return ChildFormViewModel(repo) as T
    }
}

@Suppress("UNCHECKED_CAST")
class AppInfoViewModelFactory(
    private val repo: ApplicationRepository,
    private val isDelete: Boolean
) :
    ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return ApplicationAddViewModel(repo) as T
    }
}

@Suppress("UNCHECKED_CAST")
class AppInfoChildListViewModelFactory(private val repo: ApplicationRepository) :
    ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return ApplicationChildListViewModel(repo) as T
    }
}
