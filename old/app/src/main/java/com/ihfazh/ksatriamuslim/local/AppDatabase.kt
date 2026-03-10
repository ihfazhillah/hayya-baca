package com.ihfazh.ksatriamuslim.local

import android.content.Context
import androidx.room.*
import androidx.room.migration.AutoMigrationSpec
import com.ihfazh.ksatriamuslim.local.converters.Converters
import com.ihfazh.ksatriamuslim.local.data.*


interface Migrate5To6 : AutoMigrationSpec


@Database(
    entities = [
        BackgroundEntity::class,
        BookEntity::class,
        ChildEntity::class,
        BookPageEntity::class,
        BookUIEntity::class,
        RewardHistoryEntity::class,
        BookKeysEntity::class,
        SelectedApplicationEntity::class,
        ProfilePictureEntity::class,
        ProfilePictureKeyEntity::class,
    ],
    version = 13,
    autoMigrations = [
        AutoMigration(from = 1, to = 2),
        AutoMigration(from = 2, to = 3),
        AutoMigration(from = 3, to = 4),
        AutoMigration(from = 4, to = 5),
        AutoMigration(from = 5, to = 6, spec = AppDatabase.Migrate5To6::class),
        AutoMigration(from = 6, to = 7),
        AutoMigration(from = 7, to = 8),
        AutoMigration(from = 8, to = 9),
        AutoMigration(from = 9, to = 10),
        AutoMigration(from = 10, to = 11),
        AutoMigration(from = 11, to = 12),
        AutoMigration(from = 12, to = 13),
    ],
)
@TypeConverters(Converters::class)
abstract class AppDatabase: RoomDatabase() {
    abstract fun backgroundDao(): BackgroundDao
    abstract fun bookDao(): BookDao
    abstract fun bookKeysDao(): BookKeysDao
    abstract fun childDao(): ChildDao
    abstract fun profilePictureKeysDao(): ProfilePictureKeyDao
    abstract fun rewardHistoryDao(): RewardHistoryDao
    abstract fun applicationDao(): ApplicationDao

    companion object {
        private var db: AppDatabase? = null
        fun getDB(context: Context): AppDatabase {
            return db ?: synchronized(this) {
                db ?: Room.databaseBuilder(
                    context,
                    AppDatabase::class.java,
                    "ksatriamuslim-db"
                ).build()
            }
        }

    }

    @DeleteColumn(
        tableName = "book",
        columnName = "pages"
    )
    @DeleteColumn(
        tableName = "book",
        columnName = "gift_opened"
    )
    class Migrate5To6 : AutoMigrationSpec
}