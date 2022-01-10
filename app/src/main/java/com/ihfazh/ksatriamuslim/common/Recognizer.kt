package com.ihfazh.ksatriamuslim.common

import android.util.Log
import com.ihfazh.ksatriamuslim.MicrophoneAudioInput
import com.microsoft.cognitiveservices.speech.SourceLanguageConfig
import com.microsoft.cognitiveservices.speech.SpeechConfig
import com.microsoft.cognitiveservices.speech.SpeechRecognizer
import com.microsoft.cognitiveservices.speech.audio.AudioConfig
import com.microsoft.cognitiveservices.speech.audio.AudioInputStream
import java.util.concurrent.Executors
import java.util.concurrent.Future

typealias OnRecognizing = (text: String) -> Unit
typealias OnRecognized = (text: String) -> Unit


object Recognizer {
    private var executorService = Executors.newCachedThreadPool()

    private fun <T> setOnTaskCompletedListener(
        task: Future<T>,
        onTaskCompletedListener: (T) -> Unit
    ) {
        executorService.submit {
            val result = task.get()
            onTaskCompletedListener.invoke(result)
        }

    }

    private var microphoneStream: MicrophoneAudioInput? = null
    private fun createMicrophoneStream(): MicrophoneAudioInput {
        if (microphoneStream != null) {
            microphoneStream?.close()
            microphoneStream = null
        }

        return MicrophoneAudioInput().also {
            microphoneStream = it
        }
    }

    private const val TAG = "Recognizer"
    private var speechRecognizer: SpeechRecognizer? = null

    var onRecognizing: OnRecognizing? = null
    var onRecognized: OnRecognized? = null

    fun startRecognizing(listener: (() -> Unit)? = null) {
        Log.d(TAG, "startRecognizing: $speechRecognizer")
        speechRecognizer?.run {
            val task = startContinuousRecognitionAsync()
            setOnTaskCompletedListener(task) {
                listener?.invoke()
            }
        }
    }

    fun stopRecognizing(listener: (() -> Unit)? = null) {
        Log.d(TAG, "stopRecognizing: stopping recongintion")
        speechRecognizer?.run {
            val task = stopContinuousRecognitionAsync()
            setOnTaskCompletedListener(task) {
                listener?.invoke()
            }

        }
    }

    fun destroy() {
        if (speechRecognizer != null) {
            speechRecognizer?.close()
            speechRecognizer = null
        }
    }

    fun initialize() {
        Log.d(TAG, "initialize recognizer")
        val config =
            SpeechConfig.fromSubscription("0f2f91cdaf924e4791ab1d253873a0f3", "southeastasia")
        val languageConfig = SourceLanguageConfig.fromLanguage("id-ID")
        val microphone = createMicrophoneStream()
        val stream = AudioInputStream.createPullStream(microphone, microphone.format)
        val audioConfig = AudioConfig.fromStreamInput(stream)

        speechRecognizer = SpeechRecognizer(
            config,
            languageConfig,
            audioConfig
        ).apply {
            recognizing.addEventListener { any, event ->
                Log.d(
                    TAG,
                    "sedang proses: ${event.result.text}"
                ); onRecognizing?.invoke(event.result.text)

            }
            recognized.addEventListener { any, event ->
                Log.d(TAG, "sudah dapat dari proses proses: ${event.result.text}")
                onRecognized?.invoke(event.result.text)

            }
        }


        if (speechRecognizer != null) {
            Log.d(TAG, "speech recognizer initialized....")
        }
    }
}