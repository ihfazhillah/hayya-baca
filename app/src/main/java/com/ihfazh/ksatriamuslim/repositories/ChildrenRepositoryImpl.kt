package com.ihfazh.ksatriamuslim.repositories

import android.content.Context
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.remote.FirestoreService
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class ChildrenRepositoryImpl(
    private val context: Context
) : ChildrenRepository {
    private val firestoreService = FirestoreService()
    private val selectedChildKey = "SELECTED_CHILD"

    override suspend fun addChild(name: String): Boolean {
        // todo: implement caching
        return firestoreService.createChild(name)
    }

    override suspend fun getChildren(): List<Children> {
        return firestoreService.getChildren()
    }

    override suspend fun updateChild(childId: String, name: String): Boolean {
        return firestoreService.updateChild(childId, name)
    }

    override suspend fun delete(childId: String): Boolean {
        return firestoreService.deleteChild(childId)
    }

    override suspend fun setSelectedChild(childId: String?): Boolean {
        return suspendCoroutine { cont ->
            val sharedPreference =
                context.getSharedPreferences("ksatriamuslim", Context.MODE_WORLD_WRITEABLE)
            with(sharedPreference.edit()) {
                putString(selectedChildKey, childId)
                apply()
                cont.resume(true)
            }
        }
    }

    override suspend fun getSelectedChild(): String? {
        return suspendCoroutine { cont ->
            val sharedPreference =
                context.getSharedPreferences("ksatriamuslim", Context.MODE_PRIVATE)
            cont.resume(sharedPreference.getString(selectedChildKey, null))
        }
    }

    override suspend fun getChild(childId: String): Children {
        return firestoreService.getChild(childId)
    }


}