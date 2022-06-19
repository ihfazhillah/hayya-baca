package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.AppInfo
import com.ihfazh.ksatriamuslim.domain.AppInfoSelect
import com.ihfazh.ksatriamuslim.domain.RequestAccess

interface ApplicationRepository {
    suspend fun getAppsInfoForSelection(): List<AppInfoSelect>
    suspend fun getAppsInfoForDeletion(): List<AppInfoSelect>
    suspend fun getAppsInfo(): List<AppInfo>
    suspend fun insertAll(apps: List<AppInfoSelect>)
    suspend fun deleteAll(apps: List<AppInfoSelect>)
    suspend fun requestAccess(appInfo: AppInfo): RequestAccess
    suspend fun logStartUsagePackage()
    suspend fun logEndUsagePackage()
}