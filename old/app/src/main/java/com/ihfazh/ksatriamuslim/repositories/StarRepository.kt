package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Star

interface StarRepository {
    suspend fun getMine(): Star
    suspend fun increaseMine(count: Int = 1)
}