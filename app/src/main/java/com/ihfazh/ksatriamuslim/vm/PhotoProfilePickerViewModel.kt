package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.cachedIn
import com.ihfazh.ksatriamuslim.domain.PhotoProfilePickerScreen
import com.ihfazh.ksatriamuslim.domain.Picture
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.koin.android.annotation.KoinViewModel

@KoinViewModel
class PhotoProfilePickerViewModel(
    private val repo: ChildrenRepository
) : ViewModel() {
    private val _currentState = MutableLiveData(PhotoProfilePickerScreen())
    val currentState: LiveData<PhotoProfilePickerScreen> = _currentState

    init {
        viewModelScope.launch(Dispatchers.IO) {
            repo.getPaginatedPhotos().cachedIn(viewModelScope).collect {
                _currentState.postValue(
                    currentState.value!!.copy(photos = it)
                )
            }
        }
    }

    fun setChild(id: String) {
        viewModelScope.launch(Dispatchers.IO) {
            repo.getChild(id).fold(
                ifRight = { child ->
                    var selectedPicture: Picture? = null
                    if (child.picture != null) {
                        selectedPicture = Picture(child.pictureId!!, child.picture)
                    }
                    _currentState.postValue(
                        currentState.value!!.copy(
                            child = child,
                            selectedPhoto = selectedPicture

                        )
                    )
                },
                ifLeft = {

                }
            )
        }
    }

    fun updatePic(picture: Picture) {
        viewModelScope.launch(Dispatchers.IO) {
            repo.setPicture(picture).fold(
                ifRight = {
                    _currentState.postValue(
                        currentState.value!!.copy(
                            child = it,
                            selectedPhoto = picture
                        )
                    )
                },
                ifLeft = {

                }
            )
        }
    }
}