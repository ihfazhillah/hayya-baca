package com.ihfazh.ksatriamuslim.local.converters

import androidx.room.TypeConverter
import java.util.*

class Converters {
    @TypeConverter
    fun fromTimestamp(value: Long?): Date? {
        return value?.let { Date(it) }
    }

    @TypeConverter
    fun dateToTimeStamp(value: Date?): Long? {
        return value?.time
    }
}