package com.ihfazh.ksatriamuslim.repositories

import android.content.Context
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.ihfazh.ksatriamuslim.domain.Star
import com.ihfazh.ksatriamuslim.remote.FirestoreService
import com.ihfazh.ksatriamuslim.workers.UpdateFirestoreCoin


class StarRepositoryImpl(
    private val context: Context
) : StarRepository {
    private val firestoreService = FirestoreService()

    // TODO: ada isiannya
    private val childId = "sakinah"

    override suspend fun getMine(): Star {
        val sharedPreference = context.getSharedPreferences("ksatriamuslim", Context.MODE_PRIVATE)
        val myStar = sharedPreference.getInt("my-star", 0)

        val id = getChildId(childId)

        val remoteStar = id?.let {
            firestoreService.getFirestoreStarById(it)
        }

        return Star(remoteStar ?: myStar)
    }

    override suspend fun increaseMine(count: Int) {
        val myStar = getMine()
        val finalStar = myStar.count + count
        val id = getChildId(childId)
        val updateSuccess = id?.let {
            firestoreService.updateFireStoreStarById(id, finalStar)
        } ?: false

        if (!updateSuccess) {
            val request = OneTimeWorkRequestBuilder<UpdateFirestoreCoin>()
                .setInputData(
                    workDataOf(
                        "id" to id,
                        "coin" to finalStar
                    )
                )
                .build()

            WorkManager.getInstance(context)
                .enqueue(request)
        }

        val sharedPreference =
            context.getSharedPreferences("ksatriamuslim", Context.MODE_WORLD_READABLE)
        with(sharedPreference.edit()) {
            putInt("my-coin", myStar.count + count)
            apply()
        }
    }


    private suspend fun getChildId(username: String): String? {
        val sharedPreference = context.getSharedPreferences("ksatriamuslim", Context.MODE_PRIVATE)
        val id = sharedPreference.getString("child_id_star", null)
        return id ?: firestoreService.getChildStarIdByChild(username).also {
            it?.let {
                with(sharedPreference.edit()) {
                    putString("child_id_star", it)
                    apply()
                }
            }

        }
    }

}