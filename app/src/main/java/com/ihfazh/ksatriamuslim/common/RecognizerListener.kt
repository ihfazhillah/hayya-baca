package com.ihfazh.ksatriamuslim.common

import com.ihfazh.ksatriamuslim.domain.TextPage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentLinkedQueue


typealias OnTextPageChange = (textPage: TextPage) -> Unit
typealias OnPercentageChange = (percentage: Float) -> Unit

object RecognizerListener {
    val queue = ConcurrentLinkedQueue<TextPage>()


    var onTextPageChange: OnTextPageChange? = null
    var onPercetangeChange: OnPercentageChange? = null

    private var currentTextPage: TextPage? = null

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
            return readWords.size.toFloat() / words.size.toFloat()
        } ?: 0f
    }
}