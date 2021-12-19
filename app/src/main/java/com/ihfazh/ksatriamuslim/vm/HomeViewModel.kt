package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import androidx.lifecycle.*
import com.ihfazh.ksatriamuslim.domain.BookSummary
import com.ihfazh.ksatriamuslim.domain.Koin
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.Client
import com.ihfazh.ksatriamuslim.repositories.BookRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.KoinRepositoryImpl
import kotlinx.coroutines.launch

class HomeViewModel(application: Application): AndroidViewModel(application) {
    private val _books = MutableLiveData<List<BookSummary>>()

    val books : LiveData<List<BookSummary>>
        get() = _books

    val koin = MutableLiveData<Koin>()
    private val koinRepository = KoinRepositoryImpl(application.applicationContext)

    init {
        val local = AppDatabase.getDB(application.applicationContext)
        val remote = Client.getService()
        val repository = BookRepositoryImpl(local, remote)


        viewModelScope.launch {
            _books.value = repository.getBooksSummary()
            koin.value = koinRepository.getMine()
        }

    }

    fun getCoin(){
        viewModelScope.launch {
            val value = koinRepository.getMine()
            println("inside get coin $value")
            koin.value = value
        }
    }

}