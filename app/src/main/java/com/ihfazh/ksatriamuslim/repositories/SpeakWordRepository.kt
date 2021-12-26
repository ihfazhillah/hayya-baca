package com.ihfazh.ksatriamuslim.repositories

interface SpeakWordRepository {
    suspend fun getAudioUrls(): List<String>
    suspend fun saveAudios()
}