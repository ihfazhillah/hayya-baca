package com.ihfazh.ksatriamuslim.repositories

import android.content.Context
import com.ihfazh.ksatriamuslim.domain.Koin

class KoinRepositoryImpl(
    private val context: Context
): KoinRepository {
    override suspend fun getMine(): Koin {
        val sharedPreference = context.getSharedPreferences("ksatriamuslim", Context.MODE_PRIVATE)
        val myCoin = sharedPreference.getInt("my-coin", 0)
        println("KOIN KU $myCoin")
        return Koin(myCoin)
    }

    override suspend fun increaseMine() {
        val myCoin = getMine()
        val sharedPreference = context.getSharedPreferences("ksatriamuslim", Context.MODE_WORLD_READABLE)
        with(sharedPreference.edit()){
            putInt("my-coin", myCoin.balance + 1)
            apply()
        }
    }
}