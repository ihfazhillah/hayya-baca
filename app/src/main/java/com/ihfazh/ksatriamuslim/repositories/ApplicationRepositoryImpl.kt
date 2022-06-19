package com.ihfazh.ksatriamuslim.repositories

import android.content.Context
import android.content.Intent
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.domain.AppInfo
import com.ihfazh.ksatriamuslim.domain.AppInfoSelect
import com.ihfazh.ksatriamuslim.domain.RequestAccess
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.local.data.SelectedApplicationEntity
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimBackendService
import com.ihfazh.ksatriamuslim.remote.data.BuyPackageBody
import com.ihfazh.ksatriamuslim.remote.data.UsagePackageLogBody
import org.koin.core.annotation.Factory
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Factory
class ApplicationRepositoryImpl(
    private val context: Context,
    local: AppDatabase,
    private val remote: KsatriaMuslimBackendService,
    private val sessionManager: SessionManager
) : ApplicationRepository {
    private val appDao = local.applicationDao()
    private val packageName = "30Menit"
    private val dateFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")

    override suspend fun getAppsInfoForSelection(): List<AppInfoSelect> {
        return getApps().filterNot {
            it.id in getSelectedAppsId()
        }.map {
            AppInfoSelect(it, false)
        }
    }

    override suspend fun getAppsInfoForDeletion(): List<AppInfoSelect> {
        return getApps().filter {
            it.id in getSelectedAppsId()
        }.map {
            AppInfoSelect(it, false)
        }
    }

    override suspend fun getAppsInfo(): List<AppInfo> {
        return getApps().filter {
            it.id in getSelectedAppsId()
        }
    }

    override suspend fun insertAll(apps: List<AppInfoSelect>) {
        appDao.insertAll(apps.toEntities())
    }

    override suspend fun deleteAll(apps: List<AppInfoSelect>) {
        appDao.deleteAll(apps.toEntities())
    }

    override suspend fun requestAccess(appInfo: AppInfo): RequestAccess {
        val accessResponse = remote.buyPackage(
            BuyPackageBody(
                packageName,
                sessionManager.getSelectedChild()!!.toInt()
            )
        )
        if (accessResponse.isSuccessful) {
            val body = accessResponse.body()!!
            return RequestAccess(
                body.permissible,
                body.message,
                durationRemaining = body.durationRemaining,
                coinRemaining = body.coinRemaining
            )
        }
        return RequestAccess(false, "UNKNOWN")
    }

    override suspend fun logStartUsagePackage() {
        remote.logUsagePackage(
            UsagePackageLogBody(
                child = sessionManager.getSelectedChild()!!.toInt(),
                pkg = packageName,
                startedAt = LocalDateTime.now().format(dateFormatter)
            )
        )
    }

    override suspend fun logEndUsagePackage() {
        remote.logUsagePackage(
            UsagePackageLogBody(
                child = sessionManager.getSelectedChild()!!.toInt(),
                pkg = packageName,
                finishedAt = LocalDateTime.now().format(dateFormatter)
            )
        )
    }

    private fun getApps(): List<AppInfo> =
        Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }.let { intent ->
            context.packageManager.queryIntentActivities(intent, 0).map {
                AppInfo(
                    it.loadIcon(context.packageManager),
                    it.loadLabel(context.packageManager).toString(),
                    it.activityInfo.applicationInfo.packageName
                )
            }
        }

    private suspend fun getSelectedAppsId(): List<String> = appDao
        .getApps().map {
            it.id
        }


}

private fun List<AppInfoSelect>.toEntities(): List<SelectedApplicationEntity> {
    return map {
        it.toEntity()
    }
}

private fun AppInfoSelect.toEntity(): SelectedApplicationEntity {
    return SelectedApplicationEntity(id)
}
