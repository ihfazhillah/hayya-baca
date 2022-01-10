package com.ihfazh.ksatriamuslim.common

import android.view.View
import androidx.lifecycle.LifecycleCoroutineScope
import androidx.navigation.findNavController
import com.ihfazh.ksatriamuslim.repositories.KoinRepositoryImpl
import kotlinx.coroutines.launch

class Navigator(val view: View?, private val lifecycleCoroutineScope: LifecycleCoroutineScope) {
    fun goHome(){
        Recognizer.stopRecognizing {
            view?.findNavController()?.navigateUp()
        }
    }

    fun finish(){
        view?.run {
            val koinRepository = KoinRepositoryImpl(context)
            lifecycleCoroutineScope.launch{
                koinRepository.increaseMine()
            }
            findNavController().navigateUp()
        }
    }
}