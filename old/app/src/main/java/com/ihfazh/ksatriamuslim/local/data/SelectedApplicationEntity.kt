package com.ihfazh.ksatriamuslim.local.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(
    tableName = "selected_application"
)
data class SelectedApplicationEntity(
    @PrimaryKey
    val id: String
)