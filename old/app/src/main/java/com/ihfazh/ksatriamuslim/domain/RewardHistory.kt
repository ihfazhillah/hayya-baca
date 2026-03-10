package com.ihfazh.ksatriamuslim.domain


enum class RewardType {
    Point,
    Star
}

data class RewardHistory(
    val id: String?,
    val description: String,
    val rewardType: RewardType = RewardType.Point,
    val count: Int,
    val childId: String,
)
