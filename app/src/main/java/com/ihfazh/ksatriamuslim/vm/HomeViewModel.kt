package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import android.os.Handler
import android.os.Looper
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.asFlow
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.domain.BookUI
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.BackendClient
import com.ihfazh.ksatriamuslim.repositories.BookRepositoryImpl
import com.ihfazh.ksatriamuslim.workers.ForceUpdateAllData
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.launch

class HomeViewModel(application: Application): AndroidViewModel(application) {


    val updateClicked = MutableLiveData(false)

    val children = MutableLiveData<Children>()


    private val local = AppDatabase.getDB(application.applicationContext)
    private val remote = BackendClient.getService(application.applicationContext)
    private val sessionManager = SessionManager(application.applicationContext)
    private val repository = BookRepositoryImpl(local, remote, sessionManager)

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
        val workerRequest = OneTimeWorkRequest.Builder(ForceUpdateAllData::class.java)
            .setInputData(
                workDataOf(
                    "type" to "all"
                )
            )
            .build()
        WorkManager.getInstance(getApplication()).enqueue(workerRequest)
        updateClicked.value = true
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