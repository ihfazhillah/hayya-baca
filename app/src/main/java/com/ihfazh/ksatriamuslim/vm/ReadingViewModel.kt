package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import android.speech.tts.TextToSpeech
import android.text.SpannedString
import android.text.TextPaint
import android.text.style.ClickableSpan
import android.view.View
import androidx.core.text.buildSpannedString
import androidx.lifecycle.*
import com.ihfazh.ksatriamuslim.repositories.ReadingRepositoryImpl
import kotlinx.coroutines.launch
import java.util.*

class ReadingViewModel(application: Application): AndroidViewModel(application),
    TextToSpeech.OnInitListener {

    private val repositoryImpl = ReadingRepositoryImpl()
    private  val tts: TextToSpeech

    private val _page = MutableLiveData<Int>()
    val page: LiveData<Int>
        get() = _page

    init {
        _page.value = 1
        tts = TextToSpeech(application.applicationContext, this)
    }


    val mainText = MediatorLiveData<SpannedString>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                val string = repositoryImpl.getText(page)

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
            }

        }
    }

    val hasNext = MediatorLiveData<Boolean>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                value = repositoryImpl.hasNext(page)
            }
        }
    }

    val hasPrev = MediatorLiveData<Boolean>().apply {
        addSource(_page){ page ->
            viewModelScope.launch {
                value = repositoryImpl.hasPrev(page)
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