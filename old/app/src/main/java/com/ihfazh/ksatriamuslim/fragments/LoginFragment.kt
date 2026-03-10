package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.SavedStateHandle
import androidx.navigation.fragment.findNavController
import coil.load
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.databinding.FragmentLoginBinding
import com.ihfazh.ksatriamuslim.remote.BackendClient
import com.ihfazh.ksatriamuslim.repositories.BackendAuthenticationRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.vm.AuthViewModel
import com.ihfazh.ksatriamuslim.vm.AuthViewModelFactory
import com.ihfazh.ksatriamuslim.vm.ChildViewModel

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

/**
 * A simple [Fragment] subclass.
 * Use the [LoginFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class LoginFragment : Fragment() {
    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null
    private var binding: FragmentLoginBinding? = null
    private lateinit var authRepository: BackendAuthenticationRepository
    private lateinit var childrenRepository: ChildrenRepository
    private val childViewModel: ChildViewModel by activityViewModels()
    private val authViewModel: AuthViewModel by activityViewModels {
        AuthViewModelFactory(
            authRepository
        )
    }
    private lateinit var savedStateHandle: SavedStateHandle


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.let {
            param1 = it.getString(ARG_PARAM1)
            param2 = it.getString(ARG_PARAM2)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        // Inflate the layout for this fragment
        binding = FragmentLoginBinding.inflate(inflater, container, false).apply {
            logo.load(R.drawable.logo_ksatria_muslim_watermark)

            password.setOnEditorActionListener { textView, i, keyEvent ->
                if (i == EditorInfo.IME_ACTION_DONE) {
                    doLogin()
                }
                false
            }

            submit.setOnClickListener {
                doLogin()
            }
        }
        return binding?.root
    }

//    val googleLoginContract = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
//        val task = GoogleSignIn.getSignedInAccountFromIntent(it.data)
//        if (task.isSuccessful) {
//            Log.d(TAG, "google login success")
//            lifecycleScope.launch {
//                val user = authRepository.firebaseLogin(task.result.idToken!!)
//                if (user != null) {
//                    updateUI(true)
//                } else {
//                    updateUI(false)
//                }
//            }
//        } else {
//            Log.e(TAG, "Google login error", task.exception)
//        }
//    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        savedStateHandle = findNavController().previousBackStackEntry!!.savedStateHandle
        savedStateHandle.set(LOGIN_SUCCESSFUL, false)

        val remote = BackendClient.getService(requireContext())
        val sessionManager = SessionManager(requireContext())
        authRepository = BackendAuthenticationRepository(remote, sessionManager)

        binding?.apply {
            authViewModel.loginFormState.observe(viewLifecycleOwner) { state ->
                state.emailError?.also {
                    username.error = it
                }

                state.passwordError?.also {
                    username.error = it
                }

                state.nonFieldErrors?.also {
                    showErrorDialog(it.toTypedArray())
                }
            }
        }

        authViewModel.user.observe(viewLifecycleOwner) { user ->
            if (user.token != null) {
                savedStateHandle.set(LOGIN_SUCCESSFUL, true)
                findNavController().popBackStack()
            }
        }

//        authRepository = GoogleAuthenticationRepositoryImpl(requireContext())
//        childrenRepository = ChildrenRepositoryImpl(requireContext())
//        binding.googleSignInBtn.setOnClickListener {
//            val intent = authRepository.googleClient.signInIntent
//            googleLoginContract.launch(intent)
//        }

    }

    private fun showErrorDialog(errors: Array<String>) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle(getString(R.string.login_error_title))
            .setItems(errors) { dialog, which ->
            }
            .setCancelable(true)
            .show()
    }

    private fun doLogin() {
        binding?.apply {
            authViewModel.login(username.text.toString(), password.text.toString())
        }

    }

    override fun onDestroy() {
        binding = null
        super.onDestroy()
    }

    companion object {
        const val LOGIN_SUCCESSFUL = "LOGIN_SUCCESSFUL"

        /**
         * Use this factory method to create a new instance of
         * this fragment using the provided parameters.
         *
         * @param param1 Parameter 1.
         * @param param2 Parameter 2.
         * @return A new instance of fragment LoginFragment.
         */
        // TODO: Rename and change types and number of parameters
        const val TAG = "LOGIN FRAGMENT"
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            LoginFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }
}