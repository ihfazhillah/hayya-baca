package com.ihfazh.ksatriamuslim.local

import android.content.Context
import androidx.room.*
import com.ihfazh.ksatriamuslim.local.converters.Converters
import com.ihfazh.ksatriamuslim.local.data.BackgroundEntity
import com.ihfazh.ksatriamuslim.local.data.BookEntity

@Database(
    entities = [BackgroundEntity::class, BookEntity::class],
    version = 3,
    autoMigrations = [
        AutoMigration(from = 1, to = 2),
        AutoMigration(from = 2, to = 3)
    ],
)
@TypeConverters(Converters::class)
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