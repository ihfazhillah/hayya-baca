package com.ihfazh.ksatriamuslim.common

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
}