package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.speech.tts.TextToSpeech
import android.text.SpannedString
import android.text.TextPaint
import android.text.style.ClickableSpan
import android.view.View
import androidx.appcompat.content.res.AppCompatResources
import androidx.core.text.buildSpannedString
import androidx.lifecycle.*
import coil.imageLoader
import coil.request.ImageRequest
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.domain.Background
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.Client
import com.ihfazh.ksatriamuslim.repositories.BookRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.ReadingBackgroundRepositoryImpl
import kotlinx.coroutines.launch
import java.util.*

class ReadingViewModel(application: Application): AndroidViewModel(application),
    TextToSpeech.OnInitListener {

    private val local = AppDatabase.getDB(application.applicationContext)
    private val remote = Client.getService()
    private val bookRepository = BookRepositoryImpl(local, remote)

    private  val tts: TextToSpeech

    private val _page = MutableLiveData<Int>()
    val page: LiveData<Int>
        get() = _page

    val bookId = MutableLiveData<String>()

    val loading = MutableLiveData(false)
    val background = MutableLiveData<Background?>()

    val textColor = MutableLiveData(Color.BLACK)
    val backgroundImage = MutableLiveData<Drawable>()


    private val repository: ReadingBackgroundRepositoryImpl


    init {
        _page.value = 1
        tts = TextToSpeech(application.applicationContext, this)

        // add background repository
        val remote = Client.getService()
        val local = AppDatabase.getDB(application.applicationContext)
        repository = ReadingBackgroundRepositoryImpl(local, remote)
        loading.value = true

        viewModelScope.launch {
            val bg = repository.getBackground()
            background.value = bg

            if (bg != null){

                // load image
                val imageUrl = "https://ksatriamuslim.com/${bg.src}"
                val request = ImageRequest.Builder(application.applicationContext).data(imageUrl)
                    .fallback(R.drawable.ic_artboard8)
                    .build()

                val drawable = application.applicationContext.imageLoader.execute(request).drawable

                if (drawable != null){
                    drawable.also {
                        backgroundImage.value = it
                        textColor.value = Color.parseColor(bg.text_color)
                    }
                } else {
                    backgroundImage.value = AppCompatResources.getDrawable(application, R.drawable.ic_artboard8)
                    textColor.value = Color.parseColor("#ffffff")
                }

                loading.value = false
        }
    }
}


    val isFinish = MutableLiveData(false)

    val mainText = MediatorLiveData<SpannedString>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                val string = bookRepository.getPage(bookId.value!!, page)
                if (string != null) {
                    val final = buildSpannedString {
                        string.split(" ").forEach {
                            append(it)
                            setSpan(object: ClickableSpan(){
                                override fun onClick(p0: View) {
                                    println("clicked $it")
                                    tts.speak(it, TextToSpeech.QUEUE_FLUSH, null)
                                }

                                override fun updateDrawState(ds: TextPaint) {
                                    ds.isUnderlineText = false
                                }
                            }, length - it.length, length, 0)
                            append(" ")
                        }
                    }
                    value =  final
                } else {
                    isFinish.value = true
                }
            }
        }
    }

    val hasNext = MediatorLiveData<Boolean>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                value = bookRepository.hasNext(bookId.value!!, page)
            }
        }
    }

    val hasPrev = MediatorLiveData<Boolean>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                value = bookRepository.hasPrev(bookId.value!!, page)
            }
        }
    }


    fun nextPage(){
        _page.value = (_page.value)?.inc() ?: 0
    }

    fun prevPage(){
        _page.value = (_page.value)?.dec() ?: 0
    }

    override fun onInit(status: Int) {
        if (status != TextToSpeech.ERROR){
            val locale = Locale("id", "ID")
            tts.language = locale
            tts.setEngineByPackageName("com.google.android.tts")
        }

    }

    fun clearTTS(){
        tts.stop()
        tts.shutdown()
    }
}