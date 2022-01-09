package com.ihfazh.ksatriamuslim.common

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import java.util.concurrent.Executors


typealias OnVoiceAvailable = (buffer: ByteArray) -> Unit
typealias OnStreamingFinished = () -> Unit

class VoiceStreamer {
    private var voiceRecorder: AudioRecord? = null

    var onVoiceAvailable: OnVoiceAvailable? = null
    var onStreamingFinished: OnStreamingFinished? = null

    private val executor = Executors.newFixedThreadPool(1)
    private var isStreaming = false

    companion object {
        private const val TAG = "Voice Streamer"
        private const val sampleRate = 44000
        private const val channelConfig = AudioFormat.CHANNEL_IN_MONO
        private const val audioFormat = AudioFormat.ENCODING_PCM_16BIT
        private var minBufferSize: Int = 1024
    }

    @SuppressLint("MissingPermission")
    private val runnableAudioStream = Thread {
        try {
            val buffer = ByteArray(minBufferSize)
            if (voiceRecorder == null) {
                AudioRecord(
                    MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                    sampleRate,
                    channelConfig,
                    audioFormat,
                    minBufferSize * 2
                ).also {
                    voiceRecorder = it
                }
            }

            voiceRecorder?.apply {
                startRecording()
                while (isStreaming) {

                    minBufferSize = read(buffer, 0, buffer.size)
                    if (isHearingVoice(buffer, minBufferSize)) {
                        onVoiceAvailable?.invoke(buffer)
                    }

                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

//    val sampleRate: Int
//        get() = if (voiceRecorder != null){
//            voiceRecorder!!.sampleRate
//        } else 0

    fun stopVoiceStreaming() {
        isStreaming = false
        voiceRecorder?.release()
        voiceRecorder = null
        if (runnableAudioStream.isAlive) {
            executor.shutdown()
        }
        onStreamingFinished?.invoke()
    }

    fun startVoiceStreaming() {
        isStreaming = true
        executor.submit(runnableAudioStream)
    }

    /*
    private boolean isHearingVoice(byte[] buffer, int size) {
            for (int i = 0; i < size - 1; i += 2) {
                // The buffer has LINEAR16 in little endian.
                int s = buffer[i + 1];
                if (s < 0) s *= -1;
                s <<= 8;
                s += Math.abs(buffer[i]);
                if (s > AMPLITUDE_THRESHOLD) {
                    return true;
                }
            }
            return false;
        }
     */

    private fun isHearingVoice(buffer: ByteArray, size: Int): Boolean {
        return true

//        for (i in 0 until size step 2) {
//            var s = buffer[i + 1].toInt()
//            if (s < 0) {
//                s *= -1
//            }
//            s = s shl 8
//            s += abs(buffer[i].toInt())
//            if (s > 1500) {
//                return true
//            }
//        }
//        return false
    }

}