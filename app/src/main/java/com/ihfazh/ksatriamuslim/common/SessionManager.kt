package com.ihfazh.ksatriamuslim.common

import android.content.Context
import androidx.core.content.edit
import com.ihfazh.ksatriamuslim.R
import org.koin.core.annotation.Single

@Single
class SessionManager(context: Context) {
    companion object {
        private const val USER_TOKEN = "USER_TOKEN"
        private const val SELECTED_CHILD = "SELECTED_CHILD"
    }

    private val prefs =
        context.getSharedPreferences(context.getString(R.string.app_name), Context.MODE_PRIVATE)

    fun getToken(): String? =
        prefs.getString(USER_TOKEN, null)

    fun setToken(token: String?) {
        prefs.edit {
            putString(USER_TOKEN, token)
            apply()
        }
    }

    fun getSelectedChild(): String? = prefs.getString(SELECTED_CHILD, null)
    fun setSelectedChild(id: String?) = prefs.edit {
        putString(SELECTED_CHILD, id)
        apply()
    }

}