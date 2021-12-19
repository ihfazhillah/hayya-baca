package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Koin

interface KoinRepository {
    suspend fun getMine(): Koin
    suspend fun increaseMine()
}