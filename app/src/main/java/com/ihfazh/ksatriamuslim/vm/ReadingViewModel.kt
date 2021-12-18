package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

class ReadingViewModel: ViewModel() {
    val page = MutableLiveData(1)
    val mainText = MutableLiveData("Ini adalah text bacaan, semoga mudah di implementasikan.\nJangan lupa basmalah.")
    val hasNext = MutableLiveData(true)
    val hasPrev = MutableLiveData(false)
}