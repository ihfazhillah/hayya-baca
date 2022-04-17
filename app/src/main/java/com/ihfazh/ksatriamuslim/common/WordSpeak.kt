package com.ihfazh.ksatriamuslim.common

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.speech.tts.TextToSpeech
import android.util.Log
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.analytics.ktx.logEvent
import com.google.firebase.ktx.Firebase
import java.io.File
import java.io.FileNotFoundException
import java.util.*

class WordSpeak(
    val context: Context
) : TextToSpeech.OnInitListener {
    private val tts = TextToSpeech(context, this)
    private val firebaseAnalytics: FirebaseAnalytics = Firebase.analytics

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

    fun speakPage(bookId: String, page: Int, text: String) {
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

    fun speak(text: String) {
        firebaseAnalytics.logEvent(FirebaseAnalytics.Event.SELECT_CONTENT) {
            param(FirebaseAnalytics.Param.VALUE, text)
            param(FirebaseAnalytics.Param.ITEM_VARIANT, "clicked")
        }

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
        firebaseAnalytics.logEvent(FirebaseAnalytics.Event.SELECT_CONTENT) {
            param(FirebaseAnalytics.Param.VALUE, text)
            param(FirebaseAnalytics.Param.ITEM_VARIANT, "clicked audio not found")
        }
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null)
    }

    companion object {
        const val TAG = "WordSpeak"
    }
}