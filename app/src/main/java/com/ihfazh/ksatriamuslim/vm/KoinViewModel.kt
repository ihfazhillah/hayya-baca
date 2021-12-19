package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.Koin
import com.ihfazh.ksatriamuslim.repositories.KoinRepositoryImpl
import kotlinx.coroutines.launch

class KoinViewModel(application: Application): AndroidViewModel(application) {
    val koin = MutableLiveData<Koin>()
    private val repository = KoinRepositoryImpl(application.applicationContext)

    init {
        viewModelScope.launch {
            koin.value = repository.getMine()
        }
    }

    fun increaseMyCoin(){
        viewModelScope.launch {
            repository.increaseMine()
            koin.value = repository.getMine()
        }
    }
}