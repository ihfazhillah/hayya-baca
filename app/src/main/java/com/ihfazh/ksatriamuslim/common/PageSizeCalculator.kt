package com.ihfazh.ksatriamuslim.common

import android.util.DisplayMetrics
import timber.log.Timber
import kotlin.math.sqrt


data class ImageSize(
    val width: Int,
    val height: Int
)

class PageSizeCalculator(private val displayMetrics: DisplayMetrics) {
    fun guessScreenSizeQualifier(): String {
        Timber.d("display metric: ${displayMetrics.scaledDensity}")
        Timber.d("display metric: ${displayMetrics.density}")
        Timber.d("display metric: ${displayMetrics.densityDpi}")
        Timber.d("display metric xdpi: ${displayMetrics.xdpi}")
        Timber.d("display metric ydpi: ${displayMetrics.ydpi}")
        Timber.d("display metric width x height: ${displayMetrics.widthPixels} x ${displayMetrics.heightPixels}")
        val xInches = displayMetrics.widthPixels / displayMetrics.xdpi
        val yInches = displayMetrics.heightPixels / displayMetrics.ydpi
        val diagonal = sqrt((xInches * xInches).toDouble() + yInches * yInches)

        Timber.d("display metric Diagonal: $diagonal")
        if (diagonal >= 6.5) return "xhdpi"

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