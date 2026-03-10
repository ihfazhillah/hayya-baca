package com.ihfazh.ksatriamuslim.domain

import android.graphics.drawable.Drawable

data class AppInfo(
    val icon: Drawable,
    val label: String,
    val id: String
)

data class AppInfoSelect(
    val appInfo: AppInfo,
    val selected: Boolean = false
) {
    val icon = appInfo.icon
    val label = appInfo.label
    val id = appInfo.id
}
