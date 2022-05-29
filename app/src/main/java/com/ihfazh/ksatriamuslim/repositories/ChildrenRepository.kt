package com.ihfazh.ksatriamuslim.repositories

import arrow.core.Either
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.domain.ClientError
import com.ihfazh.ksatriamuslim.domain.RewardHistory

interface ChildrenRepository {
    //    suspend fun addChild(name: String, attrs: Map<String, Any> = mapOf()): Boolean
//    suspend fun getChildren(): List<Children>
//    suspend fun updateChild(child: Children): Boolean
//    suspend fun delete(childId: String): Boolean
//    suspend fun setSelectedChild(childId: String?): Boolean
//    suspend fun getSelectedChild(): String?
//    suspend fun getChild(childId: String): Children
//    suspend fun getChildren(): Either<DJError, ChildListResponse>
//    suspend fun getChild(id: String): Either<>
    suspend fun getChildren(): Either<ClientError, List<Children>>
    suspend fun getChild(id: String): Either<ClientError, Children>
    suspend fun setSelectedChild(string: String?)
    suspend fun getSelectedChild(): Either<ClientError, String?>
    suspend fun createRewardHistory(rewardHistory: RewardHistory)
}