package com.ihfazh.ksatriamuslim.remote

import android.util.Log
import androidx.paging.ExperimentalPagingApi
import androidx.paging.LoadType
import androidx.paging.PagingState
import androidx.paging.RemoteMediator
import androidx.room.withTransaction
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.local.data.ProfilePictureEntity
import com.ihfazh.ksatriamuslim.local.data.ProfilePictureKeyEntity
import java.io.InvalidObjectException


@OptIn(ExperimentalPagingApi::class)
class ProfilePictureRemoteMediator(
    private val db: AppDatabase,
    private val remote: KsatriaMuslimBackendService,
) : RemoteMediator<Int, ProfilePictureEntity>() {
    override suspend fun load(
        loadType: LoadType,
        state: PagingState<Int, ProfilePictureEntity>
    ): MediatorResult {
        val page = when (loadType) {
            LoadType.REFRESH -> {
                val keys = loadKeysForClosetsBook(state)
                keys?.nextKey ?: startingPageIndex
            }
            LoadType.APPEND -> {
                val keys = loadKeysForLastBook(state)
                keys?.nextKey ?: return MediatorResult.Success(endOfPaginationReached = false)
            }
            LoadType.PREPEND -> {
                val keys = loadKeysForFirstBook(state) ?: return MediatorResult.Error(
                    InvalidObjectException("keys should not be null for $loadType")
                )
                keys.previousKey ?: return MediatorResult.Success(endOfPaginationReached = true)
            }
        }
        return loadAndSaveApiData(page, state, loadType == LoadType.REFRESH)
    }

    private suspend fun loadKeysForFirstBook(state: PagingState<Int, ProfilePictureEntity>): ProfilePictureKeyEntity? {
        return state.pages.firstOrNull { it.data.isNotEmpty() }
            ?.data?.firstOrNull()?.let { pp ->
                db.profilePictureKeysDao().getPPKeysById(pp.id)
            }
    }

    private suspend fun loadKeysForLastBook(state: PagingState<Int, ProfilePictureEntity>): ProfilePictureKeyEntity? {
        return state.pages.lastOrNull { it.data.isNotEmpty() }
            ?.data?.lastOrNull()?.let { pp ->
                db.profilePictureKeysDao().getPPKeysById(pp.id)
            }
    }

    private suspend fun loadKeysForClosetsBook(state: PagingState<Int, ProfilePictureEntity>): ProfilePictureKeyEntity? {
        return state.anchorPosition?.let { pos ->
            state.closestItemToPosition(pos)?.id?.let { ppId ->
                db.profilePictureKeysDao().getPPKeysById(ppId)
            }
        }
    }


    private suspend fun loadAndSaveApiData(
        page: Int,
        state: PagingState<Int, ProfilePictureEntity>,
        isRefresh: Boolean
    ): MediatorResult {
        return try {
            val apiResponse = remote.getPhotoProfiles(page, state.config.pageSize)

            val photoProfiles = apiResponse.body()?.results?.map {
                ProfilePictureEntity(it.id, it.photo)
            }
            val endOfPaginationReached = apiResponse.body()?.next == null


            db.withTransaction {
                if (isRefresh) {
                    db.profilePictureKeysDao().deleteAllPPKeys()
                }

                val previousKey = if (page == startingPageIndex) null else page - 1
                val nextKey = if (endOfPaginationReached) null else page + 1

                photoProfiles?.let { pps ->
                    val keys = pps.map { pp ->
                        ProfilePictureKeyEntity(pp.id, previousKey, nextKey)
                    }
                    db.profilePictureKeysDao().insertKeys(keys)
                    db.childDao().insertProfilePictures(pps)

                }

            }
            MediatorResult.Success(endOfPaginationReached = endOfPaginationReached)
        } catch (ex: Exception) {
            Log.e(TAG, "loadAndSaveApiData: got paging error here", ex)
            MediatorResult.Error(ex)
        }
    }

    companion object {
        const val startingPageIndex = 1
        private val TAG = ProfilePictureRemoteMediator::class.java.simpleName
    }
}
