package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.AppInfo
import com.ihfazh.ksatriamuslim.domain.AppInfoSelect

interface ApplicationRepository {
    suspend fun getAppsInfoForSelection(): List<AppInfoSelect>
    suspend fun getAppsInfo(): List<AppInfo>
    suspend fun insertAll(apps: List<AppInfoSelect>)
}