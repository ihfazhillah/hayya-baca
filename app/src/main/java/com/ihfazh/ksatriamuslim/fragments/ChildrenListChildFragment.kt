package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.SavedStateHandle
import androidx.navigation.fragment.findNavController
import com.google.android.material.snackbar.Snackbar
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.ui.MenuItem
import com.ihfazh.ksatriamuslim.vm.AuthViewModel
import com.ihfazh.ksatriamuslim.vm.ChildViewModel
import com.ihfazh.ksatriamuslim.vm.ChildrenListViewModel
import com.ihfazh.ksatriamuslim.vm.ViewState
import kotlinx.coroutines.InternalCoroutinesApi
import org.koin.androidx.viewmodel.ext.android.sharedViewModel

class ChildrenListChildFragment : Fragment() {
    private val viewModel: ChildrenListViewModel by viewModels()
    private val childViewModel: ChildViewModel by sharedViewModel()
    private lateinit var savedStateHandle: SavedStateHandle

    private val authViewModel: AuthViewModel by sharedViewModel()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.fragment_children_list_child, container, false)
    }

    @OptIn(InternalCoroutinesApi::class)
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        //  make sure pop back stack
        childViewModel.refreshChildren()
//        findNavController().popBackStack()

        view.findViewById<ComposeView>(R.id.composeView).setContent {
            Page()
        }

//        savedStateHandle = findNavController().previousBackStackEntry!!.savedStateHandle
//        childViewModel.child.observe(viewLifecycleOwner) {
//            if (it != null) {
//                savedStateHandle.set(SELECTED_CHILD, it.id)
//                findNavController().popBackStack()
//            }
//        }
//        lifecycleScope.launch {
//            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
//                viewModel.viewState.collect {
//                    when (it) {
//                        is ViewState.StateSuccess -> moveToHome(it.children)
//                    }
//                }
//            }
//        }


        childViewModel.clientError.observe(viewLifecycleOwner) {
            if (it) {
                Snackbar.make(requireView(), "Token invalid", Snackbar.LENGTH_LONG).show()
                authViewModel.logout()
            }
        }
    }

    private fun moveToHome(children: Children) {
    }

    @Preview
    @Composable
    fun Page() {
        val children = childViewModel.children.collectAsState().value
        val viewState = viewModel.viewState.collectAsState().value

        LazyColumn(
            modifier = Modifier
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            item {
                Text(
                    "Kamu siapa ?",
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp
                )
            }

            item {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(children) {
                        MenuItem(title = it.name, image = it.picture) {
                            childViewModel.setSelectedChild(it.id)
                            val actionToHome =
                                ChildrenListChildFragmentDirections.actionChildrenListChildFragmentToHomeFragment()
                            findNavController().navigate(actionToHome)
                            // navigate to home
//                            if (viewState != ViewState.StateLoading) { viewModel.getChild(it.id) }
                        }
                    }
                }
            }

            item {
                ClickableText(
                    text = AnnotatedString("Masuk sebagai Orang tua", SpanStyle(color = Color.Red)),
                    onClick = {
                        if (viewState != ViewState.StateLoading) {
                            findNavController().navigate(
                                ChildrenListChildFragmentDirections.actionChildrenListChildFragmentToParentGateFragment()
                            )
                        }
                    }
                )
            }

        }

    }


    companion object {
        const val TAG = "ChildrenListChildFragment"
        const val SELECTED_CHILD = "SELECTED_CHILD"
    }
}