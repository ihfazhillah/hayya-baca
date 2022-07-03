package com.ihfazh.ksatriamuslim.vm

import android.graphics.Color
import android.os.Looper
import android.text.Spannable
import android.text.SpannableString
import android.text.TextPaint
import android.text.style.AbsoluteSizeSpan
import android.text.style.ClickableSpan
import android.text.style.ForegroundColorSpan
import android.text.style.RelativeSizeSpan
import android.util.Log
import android.view.View
import android.widget.TextView
import androidx.lifecycle.*
import coil.ImageLoader
import coil.request.ImageRequest
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.common.Constants
import com.ihfazh.ksatriamuslim.common.Recognizer
import com.ihfazh.ksatriamuslim.common.WordSpeak
import com.ihfazh.ksatriamuslim.domain.ReadingScreenState
import com.ihfazh.ksatriamuslim.domain.TextPage
import com.ihfazh.ksatriamuslim.domain.WordPage
import com.ihfazh.ksatriamuslim.domain.buildReadingScreenState
import com.ihfazh.ksatriamuslim.repositories.BookRepository
import com.ihfazh.ksatriamuslim.repositories.ReadingBackgroundRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import org.koin.android.annotation.KoinViewModel


@KoinViewModel
class ReadingViewModel(
    private val wordSpeak: WordSpeak,
    private val bookRepository: BookRepository,
    private val repository: ReadingBackgroundRepository,
    private val imageLoader: ImageLoader,
    private val imageBuilder: ImageRequest.Builder
) : ViewModel() {

    private val _state: MutableLiveData<ReadingScreenState> = MutableLiveData(
        buildReadingScreenState(wordSpeak)
    ) // make sure that initial data provided

    val state: LiveData<ReadingScreenState> = _state

    private val _page = MutableLiveData<Int>()
    val page: LiveData<Int>
        get() = _page

    val bookId = MutableLiveData<Int>()

    fun setBook(id: Int) {
        bookId.value = id

        viewModelScope.launch(Dispatchers.IO) {
            bookRepository.logBook(id)
            bookRepository.getBook(id)
            getPageData(1)
        }
    }

    private fun getPageData(page: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            val bookPage = bookRepository.getPage(bookId.value!!.toInt(), page)
            if (bookPage == null) {
                val updatedState = state.value!!.copy(
                    isFinish = true
                )
                _state.postValue(updatedState)
            } else {
                val updatedState = state.value!!.copy(
                    currentPage = page,
                    currentText = bookPage.text,
                    hasNext = bookRepository.hasNext(bookId.value!!.toInt(), page),
                    hasPrev = bookRepository.hasPrev(bookId.value!!.toInt(), page),
                )
                _state.postValue(updatedState)
            }
        }
    }

    fun getBackground() {

        viewModelScope.launch {
            val bg = repository.getBackground()

            if (bg != null) {

                // load image
                val imageUrl = Constants.getKsatriaMuslimAbsoluteUrl(bg.src)
                val request = imageBuilder.data(imageUrl)
                    .fallback(R.drawable.ic_artboard8)
                    .build()

                val drawable = imageLoader.execute(request).drawable

                val currentState = state.value!!

                if (drawable != null && bg.text_color != null) {
                    val updatedState = currentState.copy(
                        backgroundImage = drawable,
                        textColor = Color.parseColor(bg.text_color)
                    )
                    _state.postValue(updatedState)
                    Log.d(TAG, "Updated state $updatedState")

                } else {
                    val fallbackRequest = imageBuilder.data(R.drawable.ic_artboard8).build()
                    val updatedState = currentState.copy(
                        backgroundImage = imageLoader.execute(fallbackRequest).drawable,
                        textColor = Color.parseColor("#ffffff")
                    )
                    _state.postValue(updatedState)
                    Log.d(TAG, "Background gak dapat")
                }

            } else {
                Log.d(TAG, "Background gak dapat")
            }
        }
    }



    val isFinish = MutableLiveData(false)

    val textPage = MediatorLiveData<TextPage>().apply {
        addSource(_page) { page ->
            viewModelScope.launch {
                val bookPage = bookRepository.getPage(bookId.value!!.toInt(), page)
                if (bookPage == null) {
                    isFinish.value = true
                } else {
                    val words = Constants.getWordsPatterns().findAll(bookPage.text).map {
                        WordPage(
                            it.value,
                            it.range.first,
                            it.range.last,
                            false
                        )
                    }.toList()


                    value = TextPage(bookPage.text, words)
                }
            }
        }
    }


    val mainText = MediatorLiveData<SpannableString>().apply {
        addSource(textPage) { pageString ->
            val final = SpannableString(pageString.originalText)
            pageString.words.forEach {
                if (it.isRead) {
                    final.setSpan(
                        ForegroundColorSpan(Color.RED),
                        it.startPos,
                        it.endPos + 1,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }

                final.setSpan(
                    object : ClickableSpan() {
                        override fun onClick(p0: View) {
                            wordSpeak.speak(it.text)

                            val tv = p0 as TextView
                            val spanned = tv.text as Spannable
                            val start = spanned.getSpanStart(this)
                            val end = spanned.getSpanEnd(this)

                            spanned.setSpan(
                                RelativeSizeSpan(1.2f),
                                start,
                                end,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                            )


                            android.os.Handler(Looper.getMainLooper()).postDelayed(
                                {
                                    spanned.setSpan(
                                        AbsoluteSizeSpan(35, true),
                                        start,
                                        end,
                                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                                    )
                                }, 1000
                            )

                        }

                        override fun updateDrawState(ds: TextPaint) {
                            ds.isUnderlineText = false
                        }

                    }, it.startPos, it.endPos + 1, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }

            value = final
        }
    }

    val hasNext = MediatorLiveData<Boolean>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                value = bookRepository.hasNext(bookId.value!!.toInt(), page)
            }
        }
    }

    val hasPrev = MediatorLiveData<Boolean>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                value = bookRepository.hasPrev(bookId.value!!.toInt(), page)
            }
        }
    }

    val percentage = MutableLiveData<Float>()

    fun nextPage() {
        val page = state.value!!.currentPage?.inc() ?: 0
        getPageData(page)
    }

    fun calculatePercentage() {
//        val words = textPage.value!!.words
//        Log.d(TAG, "words size: ${words.size}")
//        val readWords = words.filter { it.isRead }
//        Log.d(TAG, "readWords size: ${readWords.size}")
//
//        val percentage = readWords.size.toFloat() / words.size.toFloat()
//        Log.d(TAG, "Percentage: $percentage")
//        this.percentage.value = percentage * 100f
    }

    fun prevPage() {
        val page = state.value!!.currentPage?.dec() ?: 0
        getPageData(page)
    }

    fun releaseWordSpeak() {
//        wordSpeak.release()
    }

    companion object {
        const val TAG = "Reading View Model"
    }

    val canMove = MutableStateFlow(true)
    val canNext = canMove.combine(hasNext.asFlow()) { a, b -> a && b }.asLiveData()
    val canBack = canMove.combine(hasPrev.asFlow()) { a, b -> a && b }.asLiveData()

    val micState = MutableLiveData(true)
    fun toggleMicState() {
        val currentValue = micState.value!!
        val nextValue = !currentValue

        viewModelScope.launch(Dispatchers.IO) {
            if (currentValue) {
                Recognizer.stopRecognizing()
            } else {
                Recognizer.startRecognizing()
            }
        }

        micState.value = nextValue
    }

    fun readPage() {
        wordSpeak.speak(state.value!!.currentText!!)
    }

    fun setAnimationRunning(animState: Boolean) {
        _state.postValue(
            state.value!!.copy(animationRunning = animState)
        )
    }

    fun readiness() {
        if (state.value!!.backgroundImage == null) {
            getBackground()
        }
    }

}