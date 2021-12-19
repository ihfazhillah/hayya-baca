package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import androidx.lifecycle.*
import com.ihfazh.ksatriamuslim.domain.BookSummary
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.Client
import com.ihfazh.ksatriamuslim.repositories.BookRepositoryImpl
import kotlinx.coroutines.launch

class HomeViewModel(application: Application): AndroidViewModel(application) {
    private val _books = MutableLiveData<List<BookSummary>>()

    val books : LiveData<List<BookSummary>>
        get() = _books

    init {
        val local = AppDatabase.getDB(application.applicationContext)
        val remote = Client.getService()
        val repository = BookRepositoryImpl(local, remote)

        viewModelScope.launch {
            _books.value = repository.getBooksSummary()
        }

    }

}