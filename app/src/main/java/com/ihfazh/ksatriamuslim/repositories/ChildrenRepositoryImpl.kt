package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.remote.FirestoreService

class ChildrenRepositoryImpl : ChildrenRepository {
    private val firestoreService = FirestoreService()

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

}