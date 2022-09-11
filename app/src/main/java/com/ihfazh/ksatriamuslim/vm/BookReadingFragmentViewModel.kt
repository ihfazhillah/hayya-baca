package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.repositories.BookRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.koin.android.annotation.KoinViewModel

@KoinViewModel
class BookReadingFragmentViewModel(
    private val bookRepository: BookRepository
) : ViewModel() {
    private val _pageCount = MutableLiveData<Int>()
    val pageCount: LiveData<Int> = _pageCount

    fun getPageCount(bookId: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            // ini nanti gak dipakai
            // log book
            bookRepository.getBook(bookId)
            // get book
            bookRepository.logBook(bookId)


            val count = bookRepository.getPageCount(bookId)
            _pageCount.postValue(count)
        }
    }
}