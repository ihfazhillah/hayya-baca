package com.ihfazh.ksatriamuslim.repositories

import android.util.Log
import androidx.paging.*
import arrow.core.Either
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.domain.ClientError
import com.ihfazh.ksatriamuslim.domain.Picture
import com.ihfazh.ksatriamuslim.domain.RewardHistory
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.local.data.ChildEntity
import com.ihfazh.ksatriamuslim.local.data.ChildWithPicture
import com.ihfazh.ksatriamuslim.local.data.ProfilePictureEntity
import com.ihfazh.ksatriamuslim.local.data.RewardHistoryEntity
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimBackendService
import com.ihfazh.ksatriamuslim.remote.ProfilePictureRemoteMediator
import com.ihfazh.ksatriamuslim.remote.data.ChildBody
import com.ihfazh.ksatriamuslim.remote.data.ChildResponse
import com.ihfazh.ksatriamuslim.remote.data.DJError
import com.ihfazh.ksatriamuslim.remote.data.RewardHistoryBody
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.koin.core.annotation.Factory

@Factory
class ChildrenRepositoryImpl(
    private val remote: KsatriaMuslimBackendService,
    private val db: AppDatabase,
    private val sessionManager: SessionManager
) : ChildrenRepository {
    override suspend fun getChildren(): Either<ClientError, List<Children>> {
        val dataFromDb = db.childDao().getAll()
        try {
            val listFromApi = remote.getChildren().toEither()
            return listFromApi.fold(
                ifLeft = {
                    val error = (it as DJError.HttpError)
                    Either.Left(ClientError.NetworkError(error.code, error.body))
                },
                ifRight = {
                    it.let { childList ->
                        // insert the images First
                        childList.filterNot { response ->
                            response.picture == null
                        }.map { childWithPicture ->
                            ProfilePictureEntity(
                                childWithPicture.picture!!.id,
                                childWithPicture.picture.photo
                            )
                        }.also { ppEntity ->
                            db.childDao().insertProfilePictures(ppEntity)
                        }
                        childList.map { response ->
                            response.toDbEntity()
                        }.also { childListEntity ->
                            db.childDao().insertAll(childListEntity)
                        }
                    }
                    Either.Right(db.childDao().getAll().map {
                        Log.d("REPO", "getChildren: $it")
                        it.toDomain()
                    })
                }
            )
        } catch (e: Exception) {
            Log.e("REPO", "getChildren: ini ada error", e)
            return Either.Right(dataFromDb.map { it.toDomain() })
        }
        // todo, handle pagination
        // if no pagination, kita akan kebingungan ketika datanya sudah banyak
    }

    override suspend fun getChild(id: String): Either<ClientError, Children> {
        // assume the child data already there, only query into db
        return Either.Right(db.childDao().getChild(id))
    }

    override suspend fun updateChild(children: Children): Either<ClientError, Children> {
        val response = remote.updateChild(children.id, children.toAPIBody()).toEither()
        return response.fold(
            ifLeft = {
                val error = (it as DJError.HttpError)
                Either.Left(ClientError.NetworkError(error.code, error.body))
            },
            ifRight = {
                // update data first
                db.childDao().insert(it.toDbEntity())
                Either.Right(it.toDomain())
            }
        )
    }

    override suspend fun setSelectedChild(string: String?) {
        sessionManager.setSelectedChild(string)
    }

    override suspend fun getSelectedChild(): Either<ClientError, String?> {
        return Either.Right(sessionManager.getSelectedChild())
    }

    override suspend fun createRewardHistory(rewardHistory: RewardHistory) {
        // update local
        db.rewardHistoryDao().insert(rewardHistory.toDbEntity())
        // send to network
        try {
            val response = remote.createRewardHistory(rewardHistory.toNetworkBody())
            if (response.isSuccessful) {
                db.rewardHistoryDao().update(rewardHistory.toDbEntity(true))
            } else {
                Log.d(
                    "CreateRewardHistory",
                    "createRewardHistory: something error: ${response.errorBody()?.string()}"
                )
            }
        } catch (ex: java.lang.Exception) {
            Log.e("CreateRewardHistory", "createRewardHistory: something error", ex)
        }
    }

    @OptIn(ExperimentalPagingApi::class)
    override suspend fun getPaginatedPhotos(): Flow<PagingData<Picture>> {
        val config = PagingConfig(pageSize = 15)
        val pagingMediator = ProfilePictureRemoteMediator(
            db = db,
            remote = remote
        )
        return Pager(
            config = config,
            remoteMediator = pagingMediator,
            pagingSourceFactory = {
                db.childDao().getPaginatedProfilePictures()
            }
        ).flow.map { pagingData ->
            pagingData.map { ppEntity ->
                Picture(ppEntity.id, ppEntity.photo)
            }
        }
    }


}

private fun ChildResponse.toDomain(): Children {
    return Children(id, name, points.toLong(), stars.toLong(), enableReadToMe, picture?.photo)

}

private fun Children.toAPIBody(): ChildBody {
    return ChildBody(
        id = id,
        enableReadToMe = enableReadToMe,
        name = name
    )
}

private fun RewardHistory.toNetworkBody(): RewardHistoryBody {
    return RewardHistoryBody(rewardType.name, description, count, childId.toInt())
}

private fun RewardHistory.toDbEntity(isComplete: Boolean = false): RewardHistoryEntity {
    val _id = (id ?: 0).toString()
    return RewardHistoryEntity(
        reward_type = rewardType.name,
        description = description,
        count = count,
        child_id = childId,
        isComplete = isComplete,
        id = 0
    )
}

private fun ChildResponse.toDbEntity(): ChildEntity {
    return ChildEntity(
        id,
        name,
        stars.toLong(),
        points.toLong(),
        enableReadToMe,
        parentId,
        picture?.id
    )
}

private fun ChildWithPicture.toDomain(): Children {
    return Children(id, name, coin, star, enableReadToMe, picture, pictureId)
}

