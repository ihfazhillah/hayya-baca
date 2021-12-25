package com.ihfazh.ksatriamuslim.remote

import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class FirestoreService {
    private val db = Firebase.firestore

    suspend fun getChildCoinIdByChild(name: String): String? {
        return suspendCoroutine { cont ->
            val documentRef = db.collection("child_coins")
            documentRef.whereEqualTo("child", name)
                .limit(1)
                .get()
                .addOnSuccessListener {
                    cont.resume(it.documents.first().id)
                }
        }
    }

    suspend fun getFirestoreCoinById(id: String): Int? {
        return suspendCoroutine { cont ->
            val documentRef = db.collection("child_coins").document(id)
            documentRef.get()
                .addOnSuccessListener {
                    val coin = it.data?.let { data ->
                        (data["coin"] as Long).toInt()
                    } ?: 0
                    cont.resume(coin)
                }
                .addOnFailureListener {
                    cont.resume(null)
                }
        }
    }

    suspend fun updateFireStoreById(id: String, value: Int): Boolean {
        return suspendCoroutine { cont ->
            val documentRef = db.collection("child_coins").document(id)
            documentRef.update("coin", value)
                .addOnSuccessListener {
                    cont.resume(true)
                }
                .addOnFailureListener {
                    cont.resume(false)
                }
        }
    }
}