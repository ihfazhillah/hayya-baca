package com.ihfazh.ksatriamuslim.repositories

interface CongratulateAudioRepository {
    suspend fun getRandomAudio(): Int
    suspend fun getAudios(): List<Int>
}