package com.ihfazh.ksatriamuslim.common

import android.util.Log
import com.microsoft.cognitiveservices.speech.SourceLanguageConfig
import com.microsoft.cognitiveservices.speech.SpeechConfig
import com.microsoft.cognitiveservices.speech.SpeechRecognizer
import com.microsoft.cognitiveservices.speech.audio.AudioConfig
import com.microsoft.cognitiveservices.speech.audio.AudioInputStream
import com.microsoft.cognitiveservices.speech.audio.AudioStreamFormat

typealias OnRecognizing = (text: String) -> Unit
typealias OnRecognized = (text: String) -> Unit

object Recognizer {
    private const val TAG = "Recognizer"
    private var speechRecognizer: SpeechRecognizer? = null
    val audioFormat = AudioStreamFormat.getWaveFormatPCM(44000, 16, 1)
    var inputStream = AudioInputStream.createPushStream(audioFormat)

    var onRecognizing: OnRecognizing? = null
    var onRecognized: OnRecognized? = null

    fun startRecognizing() {
        Log.d(TAG, "startRecognizing: $speechRecognizer")
        speechRecognizer?.startContinuousRecognitionAsync()
    }

    fun stopRecognizing() {
        speechRecognizer?.stopContinuousRecognitionAsync()
    }

    fun feedAudio(byteArray: ByteArray) {
//        Log.d(TAG, "feedAudio: got bytarray of audio $byteArray")
//        Log.d(TAG, "feedAudio: input stream: $inputStream")
        inputStream?.write(byteArray)
    }

    fun destroy() {
        if (speechRecognizer != null) {
            speechRecognizer?.close()
            speechRecognizer = null
        }

        if (inputStream != null) {
            inputStream?.close()
            inputStream = null
        }
    }

    fun initialize() {
//        val job = Job()
//        withContext(Dispatchers.Main + job){
        Log.d(TAG, "initialize recognizer")
        val config =
            SpeechConfig.fromSubscription("0f2f91cdaf924e4791ab1d253873a0f3", "southeastasia")
        val languageConfig = SourceLanguageConfig.fromLanguage("id-ID")

        speechRecognizer = SpeechRecognizer(
            config,
            languageConfig,
            AudioConfig.fromStreamInput(inputStream)
        ).apply {
            recognizing.addEventListener { any, event ->
                Log.d(TAG, "sedang proses: ${event.result.text}")
                onRecognizing?.invoke(event.result.text)

            }
            recognized.addEventListener { any, event ->
                Log.d(TAG, "sudah dapat dari proses proses: ${event.result.text}")
                onRecognized?.invoke(event.result.text)

            }
        }

//        }

        if (speechRecognizer != null) {
            Log.d(TAG, "speech recognizer initialized....")
        }
    }
}