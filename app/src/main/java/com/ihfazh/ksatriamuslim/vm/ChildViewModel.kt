package com.ihfazh.ksatriamuslim.vm

import android.util.Log
import androidx.lifecycle.*
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.domain.ClientError
import com.ihfazh.ksatriamuslim.domain.RewardHistory
import com.ihfazh.ksatriamuslim.domain.RewardType
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import org.koin.android.annotation.KoinViewModel

@KoinViewModel
class ChildViewModel(
    val repo: ChildrenRepository
) : ViewModel() {

    private val selectedChildId = MutableLiveData<String?>(null)


    private val _children = MutableStateFlow<List<Children>>(listOf())
    val children: StateFlow<List<Children>> = _children

    //    private val _child = MutableLiveData<Children?>(null)
    val child: LiveData<Children?> =
        selectedChildId.asFlow().combine(children) { childId, children ->
            children.find { child -> child.id == childId }
        }.asLiveData()

    // handle error, should log out
    val clientError = MutableLiveData<Boolean>(false)

    init {
        viewModelScope.launch {
            repo.getSelectedChild().fold(
                ifLeft = {

                },
                ifRight = {
                    selectedChildId.postValue(it)
                }
            )
        }
//        ()
//        refreshChildren()
    }

//    private fun getSelectedChild(){
//        viewModelScope.launch(Dispatchers.IO) {
//            repo.getSelectedChild().fold(
//                ifRight = { child ->
//                    _child.postValue(child)
//                },
//                ifLeft = {
//
//                }
//            )
//        }
//    }

    fun setSelectedChild(string: String?) {
        viewModelScope.launch(Dispatchers.IO) {
            repo.setSelectedChild(string)
            repo.getSelectedChild().fold(
                ifRight = { child ->
                    selectedChildId.postValue(child)
                },
                ifLeft = {

                }
            )
        }
    }

    fun setChildNull() {
        viewModelScope.launch(Dispatchers.IO) {
            repo.setSelectedChild(null)
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
                    if (it is ClientError.NetworkError) {
                        _children.value = listOf()
                        clientError.postValue(true)
                    }
                }
            )

        }
    }

    fun increaseMyCoin(bookId: Int?) {
        viewModelScope.launch(Dispatchers.IO) {
            repo.createRewardHistory(
                RewardHistory(null, "Finished book $bookId", RewardType.Point, 1, child.value!!.id)
            )
            refreshChildren()
//            getSelectedChild()
        }
//        children.value?.run {
//            val updatedCoin = coin?.plus(1) ?: 0
//            val newChildren = copy(coin = updatedCoin)
//            children.value = newChildren
//            viewModelScope.launch {
//                repository.updateChild(newChildren)
//            }
//        }
    }

    fun increaseMyStar(bookId: Int?, pageId: Int?, n: Long) {
        viewModelScope.launch(Dispatchers.IO) {
            if (n > 0) {
                repo.createRewardHistory(
                    RewardHistory(
                        null,
                        "Got stars for reading $bookId page $pageId",
                        RewardType.Star,
                        n.toInt(),
                        child.value!!.id
                    )
                )
            }
            // Yang penting jadi dulu
//            refreshChildren()
//            getSelectedChild()
        }
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