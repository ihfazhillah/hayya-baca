package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.AppInfo
import com.ihfazh.ksatriamuslim.domain.AppInfoSelect
import com.ihfazh.ksatriamuslim.domain.RequestAccess
import java.time.LocalDateTime

interface ApplicationRepository {
    suspend fun getAppsInfoForSelection(): List<AppInfoSelect>
    suspend fun getAppsInfoForDeletion(): List<AppInfoSelect>
    suspend fun getAppsInfo(): List<AppInfo>
    suspend fun insertAll(apps: List<AppInfoSelect>)
    suspend fun deleteAll(apps: List<AppInfoSelect>)
    suspend fun requestAccess(appInfo: AppInfo): RequestAccess
    suspend fun logStartUsagePackage(): Boolean
    suspend fun logEndUsagePackage(time: LocalDateTime? = null): Boolean

    suspend fun getAppWatcherState(): Boolean
    suspend fun setAppWatcherState(value: Boolean)
}