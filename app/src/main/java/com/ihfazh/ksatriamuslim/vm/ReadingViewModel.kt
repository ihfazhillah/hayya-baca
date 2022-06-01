package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import android.graphics.Color
import android.graphics.drawable.Drawable
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
import androidx.appcompat.content.res.AppCompatResources
import androidx.lifecycle.*
import coil.imageLoader
import coil.request.ImageRequest
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.common.Constants
import com.ihfazh.ksatriamuslim.common.Recognizer
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.common.WordSpeak
import com.ihfazh.ksatriamuslim.domain.Background
import com.ihfazh.ksatriamuslim.domain.TextPage
import com.ihfazh.ksatriamuslim.domain.WordPage
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.BackendClient
import com.ihfazh.ksatriamuslim.remote.Client
import com.ihfazh.ksatriamuslim.repositories.BookRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.ReadingBackgroundRepositoryImpl
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch


class ReadingViewModel(application: Application) : AndroidViewModel(application) {

    private val local = AppDatabase.getDB(application.applicationContext)
    private val remote = BackendClient.getService(application.applicationContext)
    private val sessionManager = SessionManager(application.applicationContext)
    private val bookRepository = BookRepositoryImpl(local, remote, sessionManager)

    private val wordSpeak = WordSpeak(application.applicationContext)

    private val _page = MutableLiveData<Int>()
    val page: LiveData<Int>
        get() = _page

    val bookId = MutableLiveData<String>()

    val background = MutableLiveData<Background?>()

    val textColor = MutableLiveData(Color.BLACK)
    val backgroundImage = MutableLiveData<Drawable>()


    private val backgroundLoading = MutableLiveData(true)
    val animationRunning = MutableLiveData(true)

    val loading = animationRunning.asFlow().combine(backgroundLoading.asFlow()) { a, b -> a && b }
        .asLiveData()

    private val repository: ReadingBackgroundRepositoryImpl


    init {
        _page.value = 1

        // add background repository
        val remote = Client.getService()
        val local = AppDatabase.getDB(application.applicationContext)
        repository = ReadingBackgroundRepositoryImpl(local, remote)
        backgroundLoading.value = true

        viewModelScope.launch {
            val bg = repository.getBackground()
            background.value = bg

            if (bg != null){

                // load image
                val imageUrl = Constants.getKsatriaMuslimAbsoluteUrl(bg.src)
                val request = ImageRequest.Builder(application.applicationContext).data(imageUrl)
                    .fallback(R.drawable.ic_artboard8)
                    .build()

                val drawable = application.applicationContext.imageLoader.execute(request).drawable

                if (drawable != null){
                    drawable.also {
                        backgroundImage.value = it
                        textColor.value = Color.parseColor(bg.text_color)
                        backgroundLoading.value = false
                    }
                } else {
                    backgroundImage.value = AppCompatResources.getDrawable(application, R.drawable.ic_artboard8)
                    textColor.value = Color.parseColor("#ffffff")
                    backgroundLoading.value = false
                }

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
        _page.value = (_page.value)?.inc() ?: 0
    }

    fun calculatePercentage() {
        val words = textPage.value!!.words
        Log.d(TAG, "words size: ${words.size}")
        val readWords = words.filter { it.isRead }
        Log.d(TAG, "readWords size: ${readWords.size}")

        val percentage = readWords.size.toFloat() / words.size.toFloat()
        Log.d(TAG, "Percentage: $percentage")
        this.percentage.value = percentage * 100f
    }

    fun prevPage() {
        _page.value = (_page.value)?.dec() ?: 0
    }

    fun releaseWordSpeak() {
        wordSpeak.release()
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
}