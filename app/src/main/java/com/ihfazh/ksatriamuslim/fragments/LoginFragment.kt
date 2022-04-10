package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.ihfazh.ksatriamuslim.databinding.FragmentLoginBinding
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.GoogleAuthenticationRepositoryImpl
import kotlinx.coroutines.launch

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
    private lateinit var binding: FragmentLoginBinding
    private lateinit var authRepository: GoogleAuthenticationRepositoryImpl
    private lateinit var childrenRepository: ChildrenRepository

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
        binding = FragmentLoginBinding.inflate(inflater, container, false)
        return binding.root
    }

    val googleLoginContract = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        val task = GoogleSignIn.getSignedInAccountFromIntent(it.data)
        if (task.isSuccessful) {
            Log.d(TAG, "google login success")
            lifecycleScope.launch {
                val user = authRepository.firebaseLogin(task.result.idToken!!)
                if (user != null) {
                    updateUI(true)
                } else {
                    updateUI(false)
                }
            }
        } else {
            Log.e(TAG, "Google login error", task.exception)
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        authRepository = GoogleAuthenticationRepositoryImpl(requireContext())
        childrenRepository = ChildrenRepositoryImpl(requireContext())
        binding.googleSignInBtn.setOnClickListener {
            val intent = authRepository.googleClient.signInIntent
            googleLoginContract.launch(intent)
        }

    }

    private fun updateUI(loggedIn: Boolean) {
        if (loggedIn) {
            lifecycleScope.launch {
                val selectedChild = childrenRepository.getSelectedChild()
                Log.d(TAG, "updateUI: $selectedChild")
                val action = if (selectedChild == null) {
                    LoginFragmentDirections.actionLoginFragmentToChildrenListChildFragment()
                } else {
                    LoginFragmentDirections.actionLoginFragmentToHomeFragment()
                }

                findNavController().navigate(action)
            }
        }
    }

    companion object {
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