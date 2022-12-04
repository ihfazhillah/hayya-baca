package com.ihfazh.ksatriamuslim.domain

import android.content.Context
import com.ihfazh.ksatriamuslim.common.AudioFileUtil
import java.io.File

data class SpeakInputPage(
    val book: Int,
    val page: Int,

    // text in a page. Used for fallback into
    // tts service
    val text: String,
) {
    fun audioFiles(context: Context): List<File> {
        return AudioFileUtil().getAudioFiles(context, book, page)

    }
}
