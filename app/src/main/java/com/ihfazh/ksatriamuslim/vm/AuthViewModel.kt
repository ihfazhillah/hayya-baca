package com.ihfazh.ksatriamuslim.vm

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ihfazh.ksatriamuslim.domain.LoginFormState
import com.ihfazh.ksatriamuslim.domain.User
import com.ihfazh.ksatriamuslim.remote.data.DJError
import com.ihfazh.ksatriamuslim.remote.data.LoginErrorResponse
import com.ihfazh.ksatriamuslim.repositories.AuthenticationRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AuthViewModel(
    private val repo: AuthenticationRepository
) : ViewModel() {
    private val _user: MutableLiveData<User>
    val user: LiveData<User>
        get() = _user

    private val _loginFormState = MutableLiveData(LoginFormState())
    val loginFormState: LiveData<LoginFormState> = _loginFormState

    init {
        val token = repo.getToken()
        _user = MutableLiveData(User(token = token))
    }

    fun login(email: String, password: String) {
        _loginFormState.value = LoginFormState(isLoading = true)
        viewModelScope.launch(Dispatchers.IO) {
            val loginResponse = repo.login(email, password)
            loginResponse.fold(
                ifRight = {
                    _loginFormState.postValue(LoginFormState(isLoading = false))
                    _user.postValue(user.value!!.copy(token = it.key))
                    repo.setToken(it.key)
                },
                ifLeft = {
                    val errors = (it as DJError.HttpError).toObject<LoginErrorResponse>()
                    val newState = LoginFormState(
                        emailError = errors.email?.joinToString("\n"),
                        passwordError = errors.password?.joinToString("\n"),
                        nonFieldErrors = errors.non_field_errors,
                        isLoading = false
                    )
                    _loginFormState.postValue(newState)

                }
            )
        }
    }
}