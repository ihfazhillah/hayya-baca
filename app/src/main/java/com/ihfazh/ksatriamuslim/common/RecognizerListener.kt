package com.ihfazh.ksatriamuslim.common

import android.util.Log
import com.ihfazh.ksatriamuslim.domain.TextPage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentLinkedQueue


typealias OnTextPageChange = (textPage: TextPage) -> Unit
typealias OnPercentageChange = (percentage: Float) -> Unit

object RecognizerListener {
    // TODO: think how the app will collect and try to flip the words


    var onTextPageChange: OnTextPageChange? = null
    var onPercetangeChange: OnPercentageChange? = null

    private val queue = ConcurrentLinkedQueue<TextPage>()
    private var currentTextPage: TextPage? = null

    fun addTextPage(textPage: TextPage) {
        if (currentTextPage == null || currentTextPage?.originalText != textPage.originalText) {
            queue.add(textPage)
            currentTextPage = null
        }
    }

    private val scope = CoroutineScope(Dispatchers.IO)

    fun onRecognized(result: String) {
        scope.launch {
            if (currentTextPage == null) {
                cancel()
            } else {
                val currentPage = currentTextPage
                val flippedWords = flipIsRead(currentPage!!, result)
                val fromQueue = queue.poll()
                currentTextPage = fromQueue ?: flippedWords
                onTextPageChange?.invoke(flippedWords)
                onPercetangeChange?.invoke(calculatePercentage())
            }
        }
    }

    fun onRecognizing(result: String) {
        scope.launch {
            val currentPage = currentTextPage ?: queue.poll()
            if (currentPage == null) {
                cancel()
            } else {
                val flippedWords = flipIsRead(currentPage, result)
                onTextPageChange?.invoke(flippedWords)
                currentTextPage = flippedWords
            }
        }
    }

    private fun flipIsRead(pageText: TextPage, text: String): TextPage {
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

    private fun calculatePercentage(): Float {
        return currentTextPage?.run {
            val readWords = words.filter { it.isRead }
            val percentage = readWords.size.toFloat() / words.size.toFloat()
            Log.d(TAG, "GET PERCENTAGE: $percentage")
            percentage
        } ?: 0f
    }

    const val TAG = "LISTENER"
}