package com.ihfazh.ksatriamuslim

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.microsoft.cognitiveservices.speech.audio.AudioStreamFormat
import com.microsoft.cognitiveservices.speech.audio.PullAudioInputStreamCallback

class MicrophoneAudioInput : PullAudioInputStreamCallback() {

    companion object {
        private const val sampleRate = 44000
        private const val channelConfig = AudioFormat.CHANNEL_IN_MONO
        private const val audioFormat = AudioFormat.ENCODING_PCM_16BIT
        private const val minBufferSize = 1024
    }

    val format: AudioStreamFormat = AudioStreamFormat.getWaveFormatPCM(
        sampleRate.toLong(),
        16,
        1
    )
    private var recorder: AudioRecord? = null

    init {
        initMic()
    }

    @SuppressLint("MissingPermission")
    private fun initMic() {
        recorder = AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            sampleRate,
            channelConfig,
            audioFormat,
            minBufferSize * 2
        )
        recorder?.startRecording()
    }

    override fun read(bytes: ByteArray): Int {
        val ret = recorder?.read(bytes, 0, bytes.size)
//        val TAG = "READ MICRHOPHONE"
//        Log.d(TAG, "read: $ret")
        return ret ?: 0
    }

    override fun close() {
        recorder?.release()
        recorder = null
    }
}