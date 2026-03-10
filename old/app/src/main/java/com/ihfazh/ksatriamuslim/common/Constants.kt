package com.ihfazh.ksatriamuslim.common

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import java.text.Normalizer
import java.util.*

object Constants {
    val baseKsatriaMuslim = "https://ksatriamuslim.com"

    fun getKsatriaMuslimAbsoluteUrl(path: String) = "$baseKsatriaMuslim/$path"

    val specialWords = listOf(
        "Shollallohu 'alaihi wasallam",
        "لا اله الا الله محمد رسول الله"
    )

    fun getWordsPatterns() = Regex(
        specialWords.joinToString("|") + "|[\\w']+",
        RegexOption.IGNORE_CASE
    )

    fun slugify(word: String, replacement: String = "-") = if (isArabic(word)) {
        word.replace("\\s+".toRegex(), replacement)
    } else {
        // from https://gist.github.com/adrianoluis/641e21dc24a1dbfb09e203d857ae76a3
        Normalizer
            .normalize(word, Normalizer.Form.NFD)
            .replace("[^\\p{ASCII}]".toRegex(), "")
            .replace("[^a-zA-Z0-9\\s]+".toRegex(), "").trim()
            .replace("\\s+".toRegex(), replacement)
            .lowercase(Locale.getDefault())
    }

    fun isArabic(word: String): Boolean {
        return Regex("[\\x{0600}-\\x{06FF}]").containsMatchIn(word)
    }

    fun getKsatriaMuslimAudioUrl(text: String): String {
        val slug = slugify(text)
        val path = "ksatriamuslim_audios/by_words/$slug.mp3"
        return getKsatriaMuslimAbsoluteUrl(path)
    }

    fun isTvVersion(context: Context): Boolean {
        val uiManager = context.getSystemService(Context.UI_MODE_SERVICE) as UiModeManager
        return uiManager.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION
    }
}