package com.ihfazh.ksatriamuslim.local.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "reward_history")
data class RewardHistoryEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Int,

    val reward_type: String,
    val description: String,
    val count: Int,
    val child_id: String,

    // try to handle offline first
    val isComplete: Boolean = false
)
