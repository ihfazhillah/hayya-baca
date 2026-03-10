package com.ihfazh.ksatriamuslim.common

import android.util.Log
import com.ihfazh.ksatriamuslim.domain.TextPage


typealias OnTextPageChange = (textPage: TextPage) -> Unit
typealias OnPercentageChange = (percentage: Float) -> Unit

object RecognizerListener {

    fun flipIsRead(pageText: TextPage, text: String): TextPage {
        val splitResult = text.split(" ").joinToString("|")
        val pattern = Regex(splitResult, RegexOption.IGNORE_CASE)

        val words = pageText.words.map {
            if (pattern.matches(it.text)) {
                it.copy(isRead = true)
            } else {
                it
            }
        }

        return pageText.copy(words = words)
    }

    fun calculatePercentage(currentTextPage: TextPage?): Float {
        return currentTextPage?.run {
            val readWords = words.filter { it.isRead }
            val percentage = readWords.size.toFloat() / words.size.toFloat()
            Log.d(TAG, "GET PERCENTAGE: $percentage")
            percentage
        } ?: 0f
    }

    const val TAG = "LISTENER"
}