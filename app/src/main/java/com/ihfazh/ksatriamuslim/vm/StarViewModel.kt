package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.Star
import com.ihfazh.ksatriamuslim.repositories.StarRepositoryImpl
import kotlinx.coroutines.launch

class StarViewModel(application: Application) : AndroidViewModel(application) {
    val star = MutableLiveData<Star>()
    private val repository = StarRepositoryImpl(application.applicationContext)

    init {
        viewModelScope.launch {
            star.value = repository.getMine()
        }
    }

    fun increaseMyCoin(incrementor: Int) {
        viewModelScope.launch {
            repository.increaseMine(incrementor)
            star.postValue(repository.getMine())
        }
    }
}