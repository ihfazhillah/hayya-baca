package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.remote.FirestoreService

class ChildrenRepositoryImpl : ChildrenRepository {
    private val firestoreService = FirestoreService()

    override suspend fun addChild(name: String): Boolean {
        // todo: implement caching
        return firestoreService.createChild(name)
    }
}