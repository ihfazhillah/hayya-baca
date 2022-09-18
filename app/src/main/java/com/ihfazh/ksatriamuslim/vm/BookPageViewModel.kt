package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.common.BookPageLoader
import com.ihfazh.ksatriamuslim.common.PageSizeCalculator
import com.ihfazh.ksatriamuslim.domain.BookPageUIData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.koin.android.annotation.KoinViewModel

@KoinViewModel
class BookPageViewModel(
    private val pageLoader: BookPageLoader,
    private val pageSizeCalculator: PageSizeCalculator
) : ViewModel() {
    private val _uiData: MutableLiveData<BookPageUIData> = MutableLiveData()
    val uiData: LiveData<BookPageUIData> = _uiData

    fun getImageData(book: Int, pageNum: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            val response = pageLoader.loadPage(book, pageNum)
            _uiData.postValue(response)
        }
    }

    private val originalImageSize = pageSizeCalculator.getOriginalImageSize()
    val originalImageHeight = originalImageSize.height
    val originalImageWidth = originalImageSize.width
}