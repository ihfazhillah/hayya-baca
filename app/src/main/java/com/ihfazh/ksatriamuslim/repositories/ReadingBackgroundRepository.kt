package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Background

interface ReadingBackgroundRepository {
    suspend fun getBackground(): Background?
    suspend fun getBackgrounds(): List<Background>?
}