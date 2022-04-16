package com.ihfazh.ksatriamuslim.remote

import android.util.Log
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import com.ihfazh.ksatriamuslim.domain.Children
import java.util.*
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class FirestoreService {
    private val db = Firebase.firestore
    private val auth = Firebase.auth

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

    suspend fun getChildStarIdByChild(name: String): String? {
        return suspendCoroutine { cont ->
            val documentRef = db.collection("child_stars")
            documentRef.whereEqualTo("child", name)
                .limit(1)
                .get()
                .addOnSuccessListener {
                    if (it.documents.isNotEmpty()) {
                        cont.resume(it.documents.first().id)
                    }
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

    suspend fun getFirestoreStarById(id: String): Int? {
        return suspendCoroutine { cont ->
            val documentRef = db.collection("child_stars").document(id)
            documentRef.get()
                .addOnSuccessListener {
                    val star = it.data?.let { data ->
                        (data["star"] as Long).toInt()
                    } ?: 0
                    cont.resume(star)
                }
                .addOnFailureListener {
                    cont.resume(null)
                }
        }
    }

    suspend fun updateFireStoreById(id: String, value: Int): Boolean {
        return suspendCoroutine { cont ->
            val documentRef = db.collection("child_coins").document(id)
            documentRef.update("coin", value, "parentUID", auth.currentUser?.uid)
                .addOnSuccessListener {
                    cont.resume(true)
                }
                .addOnFailureListener {
                    cont.resume(false)
                }
        }
    }

    suspend fun updateFireStoreStarById(id: String, value: Int): Boolean {
        return suspendCoroutine { cont ->
            val documentRef = db.collection("child_stars").document(id)
            documentRef.update("star", value)
                .addOnSuccessListener {
                    cont.resume(true)
                }
                .addOnFailureListener {
                    cont.resume(false)
                }
        }
    }

    suspend fun createChild(name: String, attrs: Map<String, Any> = mapOf()): Boolean {
        return suspendCoroutine { cont ->
            val document = hashMapOf(
                "name" to name,
                "coins" to 0,
                "stars" to 0,
                "parentUID" to auth.currentUser?.uid,
                "enableReadToMe" to attrs.getOrDefault("enableReadToMe", false),
                "time" to Date().time
            )
            db.collection("children")
                .add(document)
                .addOnSuccessListener {
                    cont.resume(true)
                }
                .addOnFailureListener {
                    cont.resume(false)
                }
        }
    }

    suspend fun getChildren(): List<Children> {
        return suspendCoroutine { cont ->
            val documentRef = db.collection("children")
            documentRef.whereEqualTo("parentUID", auth.currentUser!!.uid)
                .get()
                .addOnSuccessListener {
                    cont.resume(
                        it.documents.map { doc ->
                            Children(
                                doc.id,
                                name = doc.get("name") as String,
                                coin = doc.getLong("coins"),
                                star = doc.getLong("stars"),
                                enableReadToMe = doc.getBoolean("enableReadToMe") ?: false
                            )
                        }
                    )
                }
        }
    }

    suspend fun deleteChild(childId: String): Boolean {
        return suspendCoroutine { cont ->
            db.collection("children").document(childId)
                .delete()
                .addOnSuccessListener {
                    cont.resume(true)
                }
                .addOnFailureListener {
                    cont.resume(false)
                }
        }
    }

    suspend fun getChild(childId: String): Children {
        // todo: tambahkan check uid orang tua
        return suspendCoroutine { cont ->
            db.collection("children")
                .document(childId)
                .get()
                .addOnSuccessListener { doc ->
                    cont.resume(
                        Children(
                            childId,
                            name = doc.get("name") as String,
                            coin = doc.getLong("coins"),
                            star = doc.getLong("stars")
                        )
                    )

                }
        }
    }

    suspend fun updateChild(child: Children): Boolean {
        return suspendCoroutine { cont ->
            db.collection("children").document(child.id)
                .update(
                    "name",
                    child.name,
                    "coins",
                    child.coin,
                    "stars",
                    child.star,
                    "enableReadToMe",
                    child.enableReadToMe
                )
                .addOnSuccessListener {
                    Log.d(TAG, "updateChild: children updated")
                    cont.resume(true)
                }
                .addOnFailureListener {
                    Log.e(TAG, "updateChild: update child error", it)
                }
        }
    }

    companion object {
        const val TAG = "FirestoreService"
    }

}