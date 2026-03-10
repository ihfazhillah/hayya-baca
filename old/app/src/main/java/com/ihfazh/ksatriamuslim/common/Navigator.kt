package com.ihfazh.ksatriamuslim.common

import android.view.View
import androidx.lifecycle.LifecycleCoroutineScope
import androidx.navigation.findNavController
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class Navigator(val view: View?, private val lifecycleCoroutineScope: LifecycleCoroutineScope) {
    fun goHome(){
        lifecycleCoroutineScope.launch(Dispatchers.IO) {
            Recognizer.stopRecognizing()
        }
        view?.findNavController()?.navigateUp()
    }

}