package com.ihfazh.ksatriamuslim.vm

import android.text.SpannableString
import android.text.SpannableStringBuilder
import android.text.SpannedString
import android.text.TextPaint
import android.text.style.ClickableSpan
import android.view.View
import android.widget.TextView
import androidx.core.text.buildSpannedString
import androidx.lifecycle.*
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.repositories.ReadingRepositoryImpl
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlin.math.log

class ReadingViewModel: ViewModel() {

    private val repositoryImpl = ReadingRepositoryImpl()

//    val page = MutableLiveData<Int>().apply {
//        value = 1
//    }
    private val _page = MutableLiveData<Int>()
    val page: LiveData<Int>
        get() = _page

    init {
        _page.value = 1
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
        println("next page")
        _page.value = (_page.value)?.inc() ?: 0
        println(_page.value)
    }

    fun prevPage(){
        print("prev page")
        _page.value = (_page.value)?.dec() ?: 0
        println(_page.value)
//        page.postValue(page.value!! - 1)
//        println("prev page clicked")
//        page.value = page.value?.let {
//            it - 1
//        }
    }

}