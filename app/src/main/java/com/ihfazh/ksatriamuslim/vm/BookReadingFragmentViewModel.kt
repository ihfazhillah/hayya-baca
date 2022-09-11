package com.ihfazh.ksatriamuslim.vm

import android.graphics.drawable.Drawable
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.ImageLoader
import coil.request.ImageRequest
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.common.Constants
import com.ihfazh.ksatriamuslim.repositories.BookRepository
import com.ihfazh.ksatriamuslim.repositories.ReadingBackgroundRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.koin.android.annotation.KoinViewModel
import timber.log.Timber

@KoinViewModel
class BookReadingFragmentViewModel(
    private val bookRepository: BookRepository,
    private val readingBackgroundRepository: ReadingBackgroundRepository,
    private val imageLoader: ImageLoader,
    private val imageBuilder: ImageRequest.Builder
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

    private val _background = MutableLiveData<Drawable>()
    val background: LiveData<Drawable> = _background

    fun getBackground() {
        viewModelScope.launch {
            val bg = readingBackgroundRepository.getBackground()

            if (bg != null) {

                // load image
                val imageUrl = Constants.getKsatriaMuslimAbsoluteUrl(bg.src)
                val request = imageBuilder.data(imageUrl)
                    .fallback(R.drawable.ic_artboard8)
                    .build()

                val drawable = imageLoader.execute(request).drawable

                if (drawable != null) {
                    _background.postValue(drawable)
                } else {
                    val fallbackRequest = imageBuilder.data(R.drawable.ic_artboard8).build()
                    _background.postValue(imageLoader.execute(fallbackRequest).drawable)
                    Timber.w("Background image gak dapat, pakai default")
                }

            } else {
                Timber.w("Background image gak dapat")
            }
        }
    }
}