package com.ihfazh.ksatriamuslim.vm

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepositoryImpl

class ChildFormViewModel : ViewModel() {
    var loading by mutableStateOf(false)
    var name by mutableStateOf("")

    private val ERROR_TEXT = "Nama anak minimal 3 huruf."
    var error: String? by mutableStateOf(ERROR_TEXT)

    private val childrenRepository: ChildrenRepository = ChildrenRepositoryImpl()

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
        return childrenRepository.addChild(name)
    }

    fun reset() {
        loading = false
        error = null
        name = ""
    }
}