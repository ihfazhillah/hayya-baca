package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepositoryImpl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed class ViewState {
    // TODO, add state display list
    data class StateSuccess(val children: Children) : ViewState()
    object StateLoading : ViewState()
    object StateIdle : ViewState()
}

class ChildrenListViewModel(application: Application) : AndroidViewModel(application) {
    val children: MutableStateFlow<List<Children>> = MutableStateFlow(listOf())

    private val _viewState: MutableStateFlow<ViewState> = MutableStateFlow(ViewState.StateIdle)
    val viewState: StateFlow<ViewState> = _viewState

    private val repository: ChildrenRepository =
        ChildrenRepositoryImpl(application.applicationContext)

    init {
        getChildren()
    }

    private fun getChildren() {
        viewModelScope.launch {
            if (children.value.isEmpty()) {
                children.value = repository.getChildren()
            }
        }
    }

    fun getChild(childId: String) {
        _viewState.update {
            ViewState.StateLoading
        }

        viewModelScope.launch {
            repository.setSelectedChild(childId)
            _viewState.update {
                ViewState.StateSuccess(repository.getChild(childId))
            }
        }
    }

}