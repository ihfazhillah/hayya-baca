package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepositoryImpl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

class ChildrenListViewModel : ViewModel() {
    val children: MutableStateFlow<List<Children>> = MutableStateFlow(listOf())
    private val repository: ChildrenRepository = ChildrenRepositoryImpl()

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

}