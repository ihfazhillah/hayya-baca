package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.AppInfoSelect
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class ApplicationAddViewModel(
    private val repository: ApplicationRepository
) : ViewModel() {
    private val _applications = MutableStateFlow<List<AppInfoSelect>>(listOf())
    val applications: StateFlow<List<AppInfoSelect>> = _applications

    init {
        viewModelScope.launch(Dispatchers.IO) {
            _applications.value = repository.getAppsInfoForSelection()
        }
    }

    fun updateApplicationItem(appInfoSelect: AppInfoSelect) {
        _applications.value = applications.value.map {
            if (it.id == appInfoSelect.id && it.label == appInfoSelect.label) {
                appInfoSelect
            } else {
                it
            }
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    val selectedCount: StateFlow<Int> = applications
        .mapLatest {
            it.filter { app -> app.selected }.size
        }
        .stateIn(
            viewModelScope,
            SharingStarted.Eagerly,
            initialValue = 0
        )

    val allSelected: StateFlow<Boolean> = applications
        .mapLatest {
            it.size == selectedCount.value
        }
        .stateIn(
            viewModelScope,
            SharingStarted.Eagerly,
            initialValue = false
        )

    fun toggleSelectAll() {
        if (allSelected.value) {
            _applications.value = applications.value.map {
                it.copy(selected = false)
            }
        } else {
            _applications.value = applications.value.map {
                it.copy(selected = true)
            }
        }
    }

    fun insertAll() {
        viewModelScope.launch(Dispatchers.IO) {
            repository.insertAll(applications.value.filter {
                it.selected
            })
        }
    }
}