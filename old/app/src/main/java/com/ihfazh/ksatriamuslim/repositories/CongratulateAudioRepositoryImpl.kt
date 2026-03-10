package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.R

class CongratulateAudioRepositoryImpl: CongratulateAudioRepository {
    override suspend fun getRandomAudio(): Int{
        val audios = getAudios()
        return audios.random()
    }

    override suspend fun getAudios(): List<Int>{
        return listOf(
            R.raw.masyaalloh_kamu_hebat,
            R.raw.sudah_selesai,
            R.raw.terus_semangat,
            R.raw.akhwat_sholihah_suka_membaca
        )
    }
}