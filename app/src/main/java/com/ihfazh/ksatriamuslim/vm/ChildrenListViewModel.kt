package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepositoryImpl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

class ChildrenListViewModel(application: Application) : AndroidViewModel(application) {
    val children: MutableStateFlow<List<Children>> = MutableStateFlow(listOf())
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

}