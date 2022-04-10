package com.ihfazh.ksatriamuslim.repositories

interface ChildrenRepository {
    suspend fun addChild(name: String): Boolean
}