package com.ihfazh.ksatriamuslim.common

import java.text.Normalizer
import java.util.*

object Constants {
    val baseKsatriaMuslim = "https://ksatriamuslim.com"

    fun getKsatriaMuslimAbsoluteUrl(path: String) = "$baseKsatriaMuslim/$path"

    val specialWords = listOf(
        "Shollallohu 'alaihi wasallam"
    )

    fun getWordsPatterns() = Regex(
        specialWords.joinToString("|") + "|[\\w']+",
        RegexOption.IGNORE_CASE
    )

    // from https://gist.github.com/adrianoluis/641e21dc24a1dbfb09e203d857ae76a3
    fun slugify(word: String, replacement: String = "-") = Normalizer
        .normalize(word, Normalizer.Form.NFD)
        .replace("[^\\p{ASCII}]".toRegex(), "")
        .replace("[^a-zA-Z0-9\\s]+".toRegex(), "").trim()
        .replace("\\s+".toRegex(), replacement)
        .lowercase(Locale.getDefault())

    fun getKsatriaMuslimAudioUrl(text: String): String {
        val slug = slugify(text)
        val path = "ksatriamuslim_audios/by_words/$slug.mp3"
        return getKsatriaMuslimAbsoluteUrl(path)
    }
}