package com.ihfazh.ksatriamuslim.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.ihfazh.ksatriamuslim.local.data.BackgroundEntity

@Database(
    entities = [BackgroundEntity::class],
    version = 1
)
abstract class AppDatabase: RoomDatabase() {
    abstract fun backgroundDao(): BackgroundDao

    companion object {
        private var db: AppDatabase? = null
        fun getDB(context: Context): AppDatabase {
            return db ?: synchronized(this){
                db ?: Room.databaseBuilder(
                    context,
                    AppDatabase::class.java,
                    "ksatriamuslim-db"
                ).build()
            }
        }
    }
}