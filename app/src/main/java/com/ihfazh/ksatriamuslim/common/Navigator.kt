package com.ihfazh.ksatriamuslim.common

import android.view.View
import androidx.navigation.findNavController
import com.ihfazh.ksatriamuslim.R

class Navigator(val view: View?) {
    fun goHome(){
        view?.findNavController()?.navigateUp()
    }
}