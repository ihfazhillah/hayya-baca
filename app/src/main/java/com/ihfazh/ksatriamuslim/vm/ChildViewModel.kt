package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepositoryImpl
import kotlinx.coroutines.launch

class ChildViewModel(application: Application) : AndroidViewModel(application) {
    val children = MutableLiveData<Children>()
    private val repository: ChildrenRepository =
        ChildrenRepositoryImpl(application.applicationContext)

    fun increaseMyCoin() {
        children.value?.run {
            val updatedCoin = coin?.plus(1) ?: 0
            val newChildren = copy(coin = updatedCoin)
            children.value = newChildren
            viewModelScope.launch {
                repository.updateChild(newChildren)
            }
        }
    }

    fun increaseMyStar(n: Long) {
        children.value?.run {
            val updatedStar = star?.plus(n) ?: n
            val newChildren = copy(star = updatedStar)
            children.value = newChildren
            viewModelScope.launch {
                repository.updateChild(newChildren)
            }
        }

    }


}