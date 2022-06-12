package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.AppInfo
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ApplicationChildListViewModel(
    private val repository: ApplicationRepository,
) : ViewModel() {
    private val _applications = MutableStateFlow<List<AppInfo>>(listOf())
    val applications: StateFlow<List<AppInfo>> = _applications


    fun queryApplciations() {
        viewModelScope.launch(Dispatchers.IO) {
            _applications.value = repository.getAppsInfo()
        }
    }

    fun selectApplication(
        appInfo: AppInfo,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            val canAccess = repository.requestAccess(appInfo)
            if (canAccess.permissible) {
                onSuccess.invoke()
            } else {
                onError.invoke(canAccess.getFullMessage())
            }
        }
    }

}