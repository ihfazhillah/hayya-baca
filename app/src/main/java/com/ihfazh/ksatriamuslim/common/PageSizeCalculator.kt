package com.ihfazh.ksatriamuslim.common

import android.util.DisplayMetrics


data class ImageSize(
    val width: Int,
    val height: Int
)

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

    fun getOriginalImageSize(): ImageSize {
        return when (guessScreenSizeQualifier()) {
            "mdpi" -> ImageSize(480, 320)
            "hdpi" -> ImageSize(800, 480)
            "xhdpi" -> ImageSize(1280, 720)
            "xxhdpi" -> ImageSize(1440, 960)
            "xxxhdpi" -> ImageSize(1920, 1280)
            else -> ImageSize(1920, 1280)
        }
    }

}