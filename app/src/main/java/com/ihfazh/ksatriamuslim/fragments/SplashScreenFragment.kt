package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.repositories.AuthenticationRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.GoogleAuthenticationRepositoryImpl
import com.ihfazh.ksatriamuslim.vm.ChildViewModel
import kotlinx.coroutines.launch

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

/**
 * A simple [Fragment] subclass.
 * Use the [SplashScreenFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class SplashScreenFragment : Fragment() {
    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null
    lateinit var authRepository: AuthenticationRepository
    lateinit var childrenRepository: ChildrenRepository
    private val childViewModel: ChildViewModel by activityViewModels()

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
        return inflater.inflate(R.layout.fragment_splash_screen, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        authRepository = GoogleAuthenticationRepositoryImpl(requireContext())
        childrenRepository = ChildrenRepositoryImpl(requireContext())

        lifecycleScope.launch {
            val action = if (authRepository.isLoggedIn()) {
                val childId = childrenRepository.getSelectedChild()
                if (childId == null) {
                    SplashScreenFragmentDirections.actionSplashScreenFragmentToChildrenListChildFragment()
                } else {
                    val child = childrenRepository.getChild(childId)
                    childViewModel.children.postValue(child)
                    SplashScreenFragmentDirections.actionSplashScreenFragmentToHomeFragment()
                }
            } else {
                SplashScreenFragmentDirections.actionSplashScreenFragmentToLoginFragment()
            }

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
         * @return A new instance of fragment SplashScreenFragment.
         */
        // TODO: Rename and change types and number of parameters
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            SplashScreenFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }
}