package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.*
import com.ihfazh.ksatriamuslim.repositories.ReadingRepositoryImpl
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlin.math.log

class ReadingViewModel: ViewModel() {

    private val repositoryImpl = ReadingRepositoryImpl()

//    val page = MutableLiveData<Int>().apply {
//        value = 1
//    }
    private val _page = MutableLiveData<Int>()
    val page: LiveData<Int>
        get() = _page

    init {
        _page.value = 1
    }


    val mainText = MediatorLiveData<String>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                val string = repositoryImpl.getText(page)
                value = string
            }

        }
    }

    val hasNext = MediatorLiveData<Boolean>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                value = repositoryImpl.hasNext(page)
            }
        }
    }

    val hasPrev = MediatorLiveData<Boolean>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                value = repositoryImpl.hasPrev(page)
            }
        }
    }


    fun nextPage(){
        println("next page")
        _page.value = (_page.value)?.inc() ?: 0
        println(_page.value)
    }

    fun prevPage(){
        print("prev page")
        _page.value = (_page.value)?.dec() ?: 0
        println(_page.value)
//        page.postValue(page.value!! - 1)
//        println("prev page clicked")
//        page.value = page.value?.let {
//            it - 1
//        }
    }

}