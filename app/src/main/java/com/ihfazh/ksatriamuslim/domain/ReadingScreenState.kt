package com.ihfazh.ksatriamuslim.domain

import android.graphics.Color
import android.graphics.drawable.Drawable
import android.text.Spannable
import android.text.SpannableString
import android.text.style.ClickableSpan
import android.text.style.ForegroundColorSpan
import android.util.Log
import android.view.View
import com.ihfazh.ksatriamuslim.common.Constants
import com.ihfazh.ksatriamuslim.common.WordSpeak

fun buildReadingScreenState(wordSpeak: WordSpeak): ReadingScreenState {
    val readingScreenState = ReadingScreenState()
    readingScreenState.setWordSpeak(wordSpeak)
    return readingScreenState
}

data class ReadingScreenState(
    val currentPage: Int? = null,
    val currentText: String? = null,
    val hasNext: Boolean = false,
    val hasPrev: Boolean = false,
    val backgroundImage: Drawable? = null,
    val textColor: Int? = null,
    val isFinish: Boolean = false,
    val canMove: Boolean = true,
    val canBack: Boolean = true,
    val micState: Boolean = false,

    // karena asalnya played
    val animationRunning: Boolean = true
//    val selectedBackground: Background? = null,
) {
    private companion object {
        val TAG = ReadingScreenState::class.java.simpleName
    }

    private var wordSpeak: WordSpeak? = null
    fun setWordSpeak(wordSpeak: WordSpeak) {
        this.wordSpeak = wordSpeak
    }

    fun isReady(): Boolean {
        Log.d(TAG, "isReady: current page: $currentPage")
        Log.d(TAG, "isReady: current text: $currentText")
        Log.d(TAG, "isReady: backgroundImage: $backgroundImage")
        Log.d(TAG, "isReady: textColor: $textColor")
        Log.d(TAG, "isReady: animation running: $animationRunning")
        return currentPage != null && currentText != null && backgroundImage != null && textColor != null && !animationRunning
    }

    private val textPage: TextPage? =
        currentText?.let { text ->
            val words = Constants.getWordsPatterns().findAll(text).map {
                WordPage(
                    it.value,
                    it.range.first,
                    it.range.last,
                    false
                )
            }.toList()
            TextPage(text, words)
        }

    val mainText: SpannableString? =
        textPage?.let { page ->
            SpannableString(page.originalText).apply {
                page.words.forEach { wordPage ->
                    if (wordPage.isRead) {
                        setSpan(
                            ForegroundColorSpan(Color.RED),
                            wordPage.startPos,
                            wordPage.endPos + 1,
                            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                    }

                    setSpan(
                        object : ClickableSpan() {
                            override fun onClick(p0: View) {
                                wordSpeak?.speak(wordPage.text)
                            }
                        },
                        wordPage.startPos,
                        wordPage.endPos + 1,
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
            }
        }

}
