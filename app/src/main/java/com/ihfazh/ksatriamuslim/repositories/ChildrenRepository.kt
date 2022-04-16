package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Children

interface ChildrenRepository {
    suspend fun addChild(name: String): Boolean
    suspend fun getChildren(): List<Children>
    suspend fun updateChild(child: Children): Boolean
    suspend fun delete(childId: String): Boolean
    suspend fun setSelectedChild(childId: String?): Boolean
    suspend fun getSelectedChild(): String?
    suspend fun getChild(childId: String): Children
}