package com.ihfazh.ksatriamuslim.domain

import android.content.Context
import com.ihfazh.ksatriamuslim.common.AudioFileUtil
import java.io.File

data class SpeakInput(
    val book: Int,
    val page: Int,
    val index: Int,
    val text: String
) {
    fun audioFile(context: Context): File =
        AudioFileUtil().getAudioFile(context, book, page, index)
}
