package com.ihfazh.ksatriamuslim.repositories

import android.util.Log
import arrow.core.Either
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.domain.ClientError
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.local.data.ChildEntity
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimBackendService
import com.ihfazh.ksatriamuslim.remote.data.ChildResponse
import com.ihfazh.ksatriamuslim.remote.data.DJError

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
                        childList.map { response ->
                            response.toDbEntity()
                        }.also { childListEntity ->
                            db.childDao().insertAll(childListEntity)
                        }
                    }
                    Either.Right(db.childDao().getAll().map { it.toDomain() })
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
        // assume the child data already there, no query into db
        return Either.Right(db.childDao().getChild(id))
    }

    override suspend fun setSelectedChild(string: String?) {
        sessionManager.setSelectedChild(string)
    }

    override suspend fun getSelectedChild(): Either<ClientError, Children?> {
        return sessionManager.getSelectedChild()?.let {
            getChild(it)
        } ?: Either.Right(null)
    }


}

private fun ChildResponse.toDbEntity(): ChildEntity {
    return ChildEntity(id, name, points.toLong(), stars.toLong(), enableReadToMe, parentId)
}

private fun ChildEntity.toDomain(): Children {
    return Children(id, name, coin, star, enableReadToMe)
}

