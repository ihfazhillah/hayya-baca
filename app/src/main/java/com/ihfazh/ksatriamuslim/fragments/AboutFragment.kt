package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.common.fragment.BaseFragment
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.Client
import com.ihfazh.ksatriamuslim.repositories.BookRepositoryImpl
import com.ihfazh.ksatriamuslim.repositories.ReadingBackgroundRepositoryImpl
import kotlinx.coroutines.launch
import java.lang.RuntimeException

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

/**
 * A simple [Fragment] subclass.
 * Use the [AboutFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class AboutFragment : BaseFragment() {
    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null

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
        return inflater.inflate(R.layout.fragment_about, container, false)
    }

    override fun getShowStatusBarStatus(): Boolean = true

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val btnUpload = view.findViewById<Button>(R.id.updateDataBtn)

        val local = AppDatabase.getDB(requireContext())
        val remote = Client.getService()

        val bookRepository = BookRepositoryImpl(local, remote)
        val backgroundRepository = ReadingBackgroundRepositoryImpl(local, remote)
        btnUpload.setOnClickListener {
            lifecycleScope.launch {
                bookRepository.getBooksSummary(forceFetch = true)
                backgroundRepository.getBackgrounds(forceFetch = true)
                findNavController().navigateUp()
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
         * @return A new instance of fragment AboutFragment.
         */
        // TODO: Rename and change types and number of parameters
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            AboutFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }
}