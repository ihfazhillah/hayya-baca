package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.AppInfoSelect
import com.ihfazh.ksatriamuslim.repositories.ApplicationRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import org.koin.android.annotation.KoinViewModel

@KoinViewModel
class ApplicationAddViewModel(
    val repository: ApplicationRepository,
) : ViewModel() {

    private val _applications = MutableStateFlow<List<AppInfoSelect>>(listOf())
    val applications: StateFlow<List<AppInfoSelect>> = _applications

    fun queryApps(isDelete: Boolean) {
        viewModelScope.launch(Dispatchers.IO) {
            _applications.value = if (isDelete) {
                repository.getAppsInfoForDeletion()
            } else {
                repository.getAppsInfoForSelection()
            }
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

    fun insertOrDeleteAll(isDelete: Boolean = false) {
        viewModelScope.launch(Dispatchers.IO) {
            applications.value.filter {
                it.selected
            }.let { apps ->
                if (isDelete) {
                    repository.deleteAll(apps)
                } else {
                    repository.insertAll(apps)
                }
            }
        }
    }
}