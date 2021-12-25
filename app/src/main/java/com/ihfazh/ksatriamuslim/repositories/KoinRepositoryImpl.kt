package com.ihfazh.ksatriamuslim.repositories

import android.content.Context
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.ihfazh.ksatriamuslim.domain.Koin
import com.ihfazh.ksatriamuslim.remote.FirestoreService
import com.ihfazh.ksatriamuslim.workers.UpdateFirestoreCoin

class KoinRepositoryImpl(
    private val context: Context
): KoinRepository {
    private val firestoreService = FirestoreService()

    // TODO: ada isiannya
    private val childId = "sakinah"

    override suspend fun getMine(): Koin {
        val sharedPreference = context.getSharedPreferences("ksatriamuslim", Context.MODE_PRIVATE)
        val myCoin = sharedPreference.getInt("my-coin", 0)

        val id = getChildId(childId)

        val remoteCoin = id?.let {
            firestoreService.getFirestoreCoinById(it)
        }

        return Koin(remoteCoin ?: myCoin)
    }


    override suspend fun increaseMine() {
        val myCoin = getMine()
        val finalCoin = myCoin.balance + 1
        val id = getChildId(childId)

        val updateSuccess = id?.let {
            firestoreService.updateFireStoreById(id, finalCoin)
        } ?: false

        if (!updateSuccess) {
            val request = OneTimeWorkRequestBuilder<UpdateFirestoreCoin>()
                .setInputData(
                    workDataOf(
                        "id" to id,
                        "coin" to finalCoin
                    )
                )
                .build()

            WorkManager.getInstance(context)
                .enqueue(request)
        }

        val sharedPreference =
            context.getSharedPreferences("ksatriamuslim", Context.MODE_WORLD_READABLE)
        with(sharedPreference.edit()) {
            putInt("my-coin", myCoin.balance + 1)
            apply()
        }
    }

    private suspend fun getChildId(username: String): String? {
        val sharedPreference = context.getSharedPreferences("ksatriamuslim", Context.MODE_PRIVATE)
        val id = sharedPreference.getString("child_id", null)
        return id ?: firestoreService.getChildCoinIdByChild(username).also {
            it?.let {
                with(sharedPreference.edit()) {
                    putString("child_id", it)
                    apply()
                }
            }

        }
    }

}