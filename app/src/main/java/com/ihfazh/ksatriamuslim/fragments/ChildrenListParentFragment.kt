package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.MaterialTheme
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.unit.dp
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.ui.ChildItemParent
import com.ihfazh.ksatriamuslim.vm.ChildrenListViewModel

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

/**
 * A simple [Fragment] subclass.
 * Use the [ChildrenListParentFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class ChildrenListParentFragment : Fragment() {
    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null
    private val viewModel: ChildrenListViewModel by viewModels()

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
        return inflater.inflate(R.layout.fragment_children_list_parent, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val composeView = view.findViewById<ComposeView>(R.id.composeView)
        composeView.setContent { Page() }
    }

    @Composable
    fun Page(){
        data class ChildItemEntity(
            val name: String?
        )

        val children = viewModel.children.collectAsState()
        val childs = listOf(
            ChildItemEntity("LULU"),
            ChildItemEntity(null),
        )

        LazyColumn(
            modifier = Modifier
                .padding(15.dp)
        ) {
            item{
                Text(
                    text = "List anak anak",
                    style = MaterialTheme.typography.h4,
                    modifier = Modifier
                        .padding(0.dp, 0.dp, 0.dp, 5.dp)
                )
            }

            items(children.value) { item ->
                ChildItemParent(name = item.name) {
//                    if (item.name == null) {
//                        findNavController().navigate(ChildrenListParentFragmentDirections.actionChildrenListParentFragmentToChildFromFragment())
//                    }
//
                }
            }

            item {
                ChildItemParent(name = null) {
                    findNavController().navigate(ChildrenListParentFragmentDirections.actionChildrenListParentFragmentToChildFromFragment())
                }

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
         * @return A new instance of fragment ChildrenListParentFragment.
         */
        // TODO: Rename and change types and number of parameters
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            ChildrenListParentFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }
}