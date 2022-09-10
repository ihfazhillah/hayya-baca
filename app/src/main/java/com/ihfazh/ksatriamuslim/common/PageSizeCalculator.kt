package com.ihfazh.ksatriamuslim.common

import android.util.DisplayMetrics

class PageSizeCalculator(private val displayMetrics: DisplayMetrics) {
    fun guessScreenSizeQualifier(): String {
        return when {
            displayMetrics.scaledDensity >= 1 && displayMetrics.scaledDensity < 1.5 -> {
                "mdpi"
            }
            displayMetrics.scaledDensity >= 1.5 && displayMetrics.scaledDensity < 2 -> {
                "hdpi"
            }
            displayMetrics.scaledDensity >= 2 && displayMetrics.scaledDensity < 3 -> {
                "xhdpi"
            }
            displayMetrics.scaledDensity >= 3 && displayMetrics.scaledDensity < 4 -> {
                "xxhdpi"
            }
            else -> "xxxhdpi"
        }
    }

}