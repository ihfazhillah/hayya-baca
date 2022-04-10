package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Children

interface ChildrenRepository {
    suspend fun addChild(name: String): Boolean
    suspend fun getChildren(): List<Children>
}