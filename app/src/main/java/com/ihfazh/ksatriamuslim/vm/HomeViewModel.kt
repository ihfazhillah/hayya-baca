package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.repositories.HomeRepositoryImpl
import kotlinx.coroutines.launch

class HomeViewModel: ViewModel() {
    private val _books = MutableLiveData<List<Book>>()
    private val repository = HomeRepositoryImpl()

    val books : LiveData<List<Book>>
        get() = _books

    init {
        viewModelScope.launch {
            _books.value = repository.getBooks()
        }

    }

}