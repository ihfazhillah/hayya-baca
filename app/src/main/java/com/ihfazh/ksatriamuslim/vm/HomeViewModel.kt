package com.ihfazh.ksatriamuslim.vm

import android.os.Handler
import android.os.Looper
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.asFlow
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import com.ihfazh.ksatriamuslim.domain.BookUI
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.repositories.BookRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.launch
import org.koin.android.annotation.KoinViewModel

@KoinViewModel
class HomeViewModel(val repository: BookRepository) : ViewModel() {


    val updateClicked = MutableLiveData(false)

    val children = MutableLiveData<Children>()


    @OptIn(ExperimentalCoroutinesApi::class)
    val books: Flow<PagingData<BookUI>> = children.asFlow().flatMapLatest {
        repository.getPagedBooksSummary(it.id.toInt())
    }

    init {

        val handler = Handler(Looper.getMainLooper())
        handler.postDelayed(
            { updateClicked.value = false }, 1000 * 10 * 60
        )


    }


    fun openGift(id: Int) {
        viewModelScope.launch {
            repository.openGift(id)
//            _books.postValue(repository.getBooksSummary())
        }
    }

    fun updateAllData() {
//        val workerRequest = OneTimeWorkRequest.Builder(ForceUpdateAllData::class.java)
//            .setInputData(
//                workDataOf(
//                    "type" to "all"
//                )
//            )
//            .build()
//        WorkManager.getInstance(getApplication()).enqueue(workerRequest)
//        updateClicked.value = true
    }

//    fun updateBooks() {
//        viewModelScope.launch(Dispatchers.IO) {
//            // get books first without ui - using ui with cache from local
//            _books.postValue(repository.getBooksSummary())
//
//            // next get books with ui from server
//            _books.postValue(repository.refreshBooksUI())
//        }
//    }

}