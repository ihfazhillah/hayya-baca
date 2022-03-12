package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.util.Log
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.ActivityResultCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.navigation.fragment.findNavController
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.databinding.FragmentLoginBinding
import com.ihfazh.ksatriamuslim.repositories.GoogleAuthenticationRepositoryImpl

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
        updateUI(true)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        authRepository = GoogleAuthenticationRepositoryImpl(requireContext())
        val isLoggedIn = authRepository.isLoggedIn()
        updateUI(isLoggedIn)

        binding.googleSignInBtn.setOnClickListener {
            val intent = authRepository.googleClient.signInIntent
            googleLoginContract.launch(intent)
        }

    }

    private fun updateUI(loggedIn: Boolean) {
        if (loggedIn){
            val action = LoginFragmentDirections.actionLoginFragmentToHomeFragment()
            findNavController().navigate(action)
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