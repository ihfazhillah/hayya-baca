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
import com.ihfazh.ksatriamuslim.remote.data.RequestAccessBody

class ApplicationRepositoryImpl(
    private val context: Context,
    local: AppDatabase,
    private val remote: KsatriaMuslimBackendService,
    private val sessionManager: SessionManager
) : ApplicationRepository {
    private val appDao = local.applicationDao()

    override suspend fun getAppsInfoForSelection(): List<AppInfoSelect> {
        return getApps().filterNot {
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

    override suspend fun requestAccess(appInfo: AppInfo): RequestAccess {
        val accessResponse = remote.requestAccess(
            RequestAccessBody(
                -10,
                "Ijin untuk buka aplikasi ${appInfo.id} - ${appInfo.label}",
                sessionManager.getSelectedChild()!!.toInt()
            )
        )
        if (accessResponse.isSuccessful) {
            val body = accessResponse.body()!!
            return RequestAccess(
                body.permissible,
                body.message
            )
        }
        return RequestAccess(false, "UNKNOWN")
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
