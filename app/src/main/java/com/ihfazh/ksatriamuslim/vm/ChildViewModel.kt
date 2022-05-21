package com.ihfazh.ksatriamuslim.vm

import android.util.Log
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ChildViewModel(private val repo: ChildrenRepository) : ViewModel() {
    private val _child = MutableLiveData<Children?>(null)
    val child: LiveData<Children?> = _child

    private val _children = MutableStateFlow<List<Children>>(listOf())
    val children: StateFlow<List<Children>> = _children

    init {
        viewModelScope.launch(Dispatchers.IO) {
            repo.getSelectedChild().fold(
                ifRight = { child ->
                    _child.postValue(child)
                },
                ifLeft = {

                }
            )
        }
//        refreshChildren()
    }

    fun setSelectedChild(string: String) {
        viewModelScope.launch(Dispatchers.IO) {
            repo.setSelectedChild(string)
            repo.getSelectedChild().fold(
                ifRight = { child ->
                    _child.postValue(child)
                },
                ifLeft = {

                }
            )
        }
    }

    fun refreshChildren() {
        viewModelScope.launch(Dispatchers.IO) {
            repo.getChildren().fold(
                ifRight = {
                    _children.value = it
                },
                ifLeft = {
//                    when(it){
//                        ClientError.NetworkError ->
//                    }
                    Log.e("CLient Error", "refreshChildren: ${it}")
                }
            )
        }
    }

    fun increaseMyCoin() {
//        children.value?.run {
//            val updatedCoin = coin?.plus(1) ?: 0
//            val newChildren = copy(coin = updatedCoin)
//            children.value = newChildren
//            viewModelScope.launch {
//                repository.updateChild(newChildren)
//            }
//        }
    }

    fun increaseMyStar(n: Long) {
//        children.value?.run {
//            val updatedStar = star?.plus(n) ?: n
//            val newChildren = copy(star = updatedStar)
//            children.value = newChildren
//            viewModelScope.launch {
//                repository.updateChild(newChildren)
//            }
//        }
//
    }


}