package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import android.os.Handler
import android.os.Looper
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.ihfazh.ksatriamuslim.domain.BookSummary
import com.ihfazh.ksatriamuslim.domain.Koin
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.Client
import com.ihfazh.ksatriamuslim.repositories.BookRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.KoinRepositoryImpl
import com.ihfazh.ksatriamuslim.workers.ForceUpdateAllData
import kotlinx.coroutines.launch

class HomeViewModel(application: Application): AndroidViewModel(application) {
    private val _books = MutableLiveData<List<BookSummary>>()

    val books: LiveData<List<BookSummary>>
        get() = _books

    val koin = MutableLiveData<Koin>()
    private val koinRepository = KoinRepositoryImpl(application.applicationContext)

    val updateClicked = MutableLiveData(false)

    init {
        // should this the best way to do ??
        val handler = Handler(Looper.getMainLooper())
        handler.postDelayed(
            { updateClicked.value = false }, 1000 * 10 * 60
        )
    }

    private val local = AppDatabase.getDB(application.applicationContext)
    private val remote = Client.getService()
    private val repository = BookRepositoryImpl(local, remote)

    init {


        viewModelScope.launch {
            _books.value = repository.getBooksSummary()
            koin.value = koinRepository.getMine()
        }

    }

    fun getCoin() {
        viewModelScope.launch {
            val value = koinRepository.getMine()
            println("inside get coin $value")
            koin.value = value
        }
    }

    fun openGift(id: String) {
        viewModelScope.launch {
            repository.openGift(id)
            _books.value = repository.getBooksSummary()
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

}