package com.ihfazh.ksatriamuslim.vm

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.domain.ClientError
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ChildFormViewModel(val repo: ChildrenRepository) : ViewModel() {
    var loading by mutableStateOf(false)
    var name by mutableStateOf("")
    var childId by mutableStateOf<String?>(null)
    var deleteDialogOpen by mutableStateOf(false)
    var enableReadToMe by mutableStateOf(false)
    var anotherError by mutableStateOf("")

    private var _child by mutableStateOf<Children?>(null)

    private val ERROR_TEXT = "Nama anak minimal 3 huruf."
    var error: String? by mutableStateOf(ERROR_TEXT)

//    private val childrenRepository: ChildrenRepository =
//        ChildrenRepositoryImpl(application.applicationContext)

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

    fun send(): Boolean {
        // we not use create for now
        viewModelScope.launch(Dispatchers.IO) {
            repo.updateChild(_child!!.copy(name = name, enableReadToMe = enableReadToMe)).fold(
                ifLeft = {
                    anotherError = (it as ClientError.NetworkError).message
                },
                ifRight = {
                    _child = it
                    reset()
                }
            )
        }
        return true
//        loading = true
//        return if (childId == null) {
//            childrenRepository.addChild(name, mapOf("enableReadToMe" to enableReadToMe))
//        } else {
//            Log.d(TAG, "send: $_child")
//            childrenRepository.updateChild(
//                _child!!.copy(
//                    name = name,
//                    enableReadToMe = enableReadToMe
//                )
//            )
//        }
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
//        childrenRepository.delete(childId!!)
        reset()
    }

    companion object {
        const val TAG = "ChildFormViewModel"
    }
}