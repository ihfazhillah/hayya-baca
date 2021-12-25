package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.BookSummary
import com.ihfazh.ksatriamuslim.domain.Koin
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.Client
import com.ihfazh.ksatriamuslim.repositories.BookRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.KoinRepositoryImpl
import kotlinx.coroutines.launch

class HomeViewModel(application: Application): AndroidViewModel(application) {
    private val _books = MutableLiveData<List<BookSummary>>()

    val books: LiveData<List<BookSummary>>
        get() = _books

    val koin = MutableLiveData<Koin>()
    private val koinRepository = KoinRepositoryImpl(application.applicationContext)

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

}