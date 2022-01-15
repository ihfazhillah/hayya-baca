package com.ihfazh.ksatriamuslim.common

import android.util.Log
import com.ihfazh.ksatriamuslim.MicrophoneAudioInput
import com.microsoft.cognitiveservices.speech.PhraseListGrammar
import com.microsoft.cognitiveservices.speech.SourceLanguageConfig
import com.microsoft.cognitiveservices.speech.SpeechConfig
import com.microsoft.cognitiveservices.speech.SpeechRecognizer
import com.microsoft.cognitiveservices.speech.audio.AudioConfig
import com.microsoft.cognitiveservices.speech.audio.AudioInputStream
import kotlin.coroutines.suspendCoroutine

typealias OnRecognizing = (text: String) -> Unit
typealias OnRecognized = (text: String) -> Unit
typealias OnCanceled = (cancelReason: String) -> Unit


object Recognizer {


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
    private var phraseList: PhraseListGrammar? = null

    var onRecognizing: OnRecognizing? = null
    var onRecognized: OnRecognized? = null
    var onCanceled: OnCanceled? = null

    suspend fun startRecognizing() {
        Log.d(TAG, "startRecognizing: $speechRecognizer")
        return suspendCoroutine {
            speechRecognizer?.run {
                startContinuousRecognitionAsync().get()
            }
        }
    }

    suspend fun stopRecognizing(listener: (() -> Unit)? = null) {
        Log.d(TAG, "stopRecognizing: stopping recongintion")
        return suspendCoroutine {
            speechRecognizer?.stopContinuousRecognitionAsync()?.get()
        }
    }

    fun destroy() {
        if (speechRecognizer != null) {
            speechRecognizer?.close()
            speechRecognizer = null
        }
        phraseList?.clear()
        phraseList?.close()
        phraseList = null
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

            sessionStarted.addEventListener { any, eventArgs ->
                Log.d(TAG, "session started detected ${eventArgs.sessionId}")
            }
            sessionStopped.addEventListener { any, eventArgs ->
                Log.d(TAG, "session stopped detected ${eventArgs.sessionId}")
            }

            speechStartDetected.addEventListener { any, recognitionEventArgs ->
                Log.d(TAG, "speech detected start ${recognitionEventArgs.offset}")
            }
            speechEndDetected.addEventListener { any, event ->
                Log.d(TAG, "speech detected start ${event.offset}")
            }
            canceled.addEventListener { any, cancel ->
                Log.d(TAG, "speech cancelled, ${cancel.errorCode} - ${cancel.errorDetails}")
                onCanceled?.invoke(cancel.errorDetails)
            }
        }

        phraseList = PhraseListGrammar.fromRecognizer(speechRecognizer)

        if (speechRecognizer != null) {
            Log.d(TAG, "speech recognizer initialized....")
        }
    }

    fun addPhrase(text: String) {
        phraseList?.clear()
        phraseList?.addPhrase(text)
    }
}