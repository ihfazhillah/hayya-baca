package com.ihfazh.ksatriamuslim.common

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.speech.tts.TextToSpeech
import android.util.Log
import androidx.core.net.toUri
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.ihfazh.ksatriamuslim.domain.SpeakInput
import com.ihfazh.ksatriamuslim.domain.SpeakInputPage
import timber.log.Timber
import java.io.File
import java.io.FileNotFoundException
import java.util.*

class WordSpeak(
    val context: Context,
    private val player: ExoPlayer
) : TextToSpeech.OnInitListener {
    private val tts = TextToSpeech(context, this)

    override fun onInit(status: Int) {
        if (status != TextToSpeech.ERROR) {
            val locale = Locale("id", "ID")
            tts.language = locale
            tts.setEngineByPackageName("com.google.android.tts")
        }
    }

    fun release() {
        tts.stop()
        tts.shutdown()
    }

    fun speakPage(bookId: Int, page: Int, text: String) {
        val audioUrl = context.getExternalFilesDir("ksatriamuslim_audio")?.path?.plus(
            "/${bookId}__${page}.mp3"
        )

        Log.d(TAG, "speakPage: audioURL $audioUrl")

        if (audioUrl == null) {
            speakTTS(text)
            return
        }

        if (!File(audioUrl).exists()) {
            speakTTS(text)
            return
        }


        try {
            MediaPlayer().run {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )
                setOnErrorListener { mediaPlayer, what, extra ->
                    speakTTS(text)
                    mediaPlayer.reset()
                    true
                }
                setDataSource(
                    audioUrl
                )
                prepare()
                start()
                setOnCompletionListener {
                    it.reset()
                    it.release()
                }
            }
        } catch (e: FileNotFoundException) {
            speakTTS(text)
        }

    }

    fun speak(input: SpeakInput) {
        // check if file found in local
        // if not found, load tts
        if (!input.audioFile(context).exists()) {
            speakTTS(input.text)
            return
        }

        Timber.d("Loading file from ${input.audioFile(context).toUri()}")

        val media = MediaItem.fromUri(input.audioFile(context).toUri())
        player.setMediaItem(media)
        player.prepare()
        player.play()
    }

    fun speakPage(input: SpeakInputPage) {
        if (input.audioFiles(context).isEmpty()) {
            speakTTS(input.text)
            return
        }

        val mediaItems = input.audioFiles(context).map {
            MediaItem.fromUri(it.toUri())
        }
        player.setMediaItems(mediaItems)
        player.prepare()
        player.play()
    }

    fun speak(text: String) {

        val audioUrl = context.getExternalFilesDir("ksatriamuslim_audio")?.path?.plus(
            "/${
                Constants.slugify(text)
            }.mp3"
        )

        if (audioUrl == null) {
            speakTTS(text)
            return
        }

        if (!File(audioUrl).exists()) {
            speakTTS(text)
            return
        }


        try {
            MediaPlayer().run {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )
                setOnErrorListener { mediaPlayer, what, extra ->
                    speakTTS(text)
                    mediaPlayer.reset()
                    true
                }
                setDataSource(
                    audioUrl
                )
                prepare()
                start()
                setOnCompletionListener {
                    it.reset()
                    it.release()
                }
            }
        } catch (e: FileNotFoundException) {
            speakTTS(text)
        }

    }

    private fun speakTTS(text: String) {
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null)
    }

    companion object {
        const val TAG = "WordSpeak"
    }
}