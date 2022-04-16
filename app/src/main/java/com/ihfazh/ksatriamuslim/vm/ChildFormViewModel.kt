package com.ihfazh.ksatriamuslim.vm

import android.app.Application
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepositoryImpl

class ChildFormViewModel(application: Application) : AndroidViewModel(application) {
    var loading by mutableStateOf(false)
    var name by mutableStateOf("")
    var childId by mutableStateOf<String?>(null)
    var deleteDialogOpen by mutableStateOf(false)
    var enableReadToMe by mutableStateOf(false)

    private var _child by mutableStateOf<Children?>(null)

    private val ERROR_TEXT = "Nama anak minimal 3 huruf."
    var error: String? by mutableStateOf(ERROR_TEXT)

    private val childrenRepository: ChildrenRepository =
        ChildrenRepositoryImpl(application.applicationContext)

    fun setChild(child: Children) {
        this.name = child.name
        childId = child.id
        enableReadToMe = child.enableReadToMe
        error = null
        _child = child
    }

    fun validateName() {
        error = if (name.length < 3) {
            ERROR_TEXT
        } else {
            null
        }
    }

    fun canSend(): Boolean {
        return error == null && !loading
    }

    suspend fun send(): Boolean {
        loading = true
        return if (childId == null) {
            childrenRepository.addChild(name, mapOf("enableReadToMe" to enableReadToMe))
        } else {
            Log.d(TAG, "send: $_child")
            childrenRepository.updateChild(
                _child!!.copy(
                    name = name,
                    enableReadToMe = enableReadToMe
                )
            )
        }
    }

    fun reset() {
        loading = false
        error = ERROR_TEXT
        name = ""
        childId = null
        deleteDialogOpen = false
        enableReadToMe = false
        _child = null
    }

    suspend fun delete() {
        childrenRepository.delete(childId!!)
        reset()
    }

    companion object {
        const val TAG = "ChildFormViewModel"
    }
}