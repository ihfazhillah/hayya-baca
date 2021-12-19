package com.ihfazh.ksatriamuslim.local

import android.content.Context
import androidx.room.AutoMigration
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.ihfazh.ksatriamuslim.local.data.BackgroundEntity
import com.ihfazh.ksatriamuslim.local.data.BookEntity

@Database(
    entities = [BackgroundEntity::class, BookEntity::class],
    version = 2,
    autoMigrations = [
        AutoMigration(from = 1, to = 2)
    ]
)
abstract class AppDatabase: RoomDatabase() {
    abstract fun backgroundDao(): BackgroundDao
    abstract fun bookDao(): BookDao

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