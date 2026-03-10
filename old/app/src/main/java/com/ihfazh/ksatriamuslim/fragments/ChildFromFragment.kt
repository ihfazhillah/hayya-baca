package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.BackendClient
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepositoryImpl
import com.ihfazh.ksatriamuslim.vm.ChildFormViewModel
import com.ihfazh.ksatriamuslim.vm.ChildFormViewModelFactory
import kotlinx.coroutines.launch

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

/**
 * A simple [Fragment] subclass.
 * Use the [ChildFromFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class ChildFromFragment : Fragment() {
    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null
    private lateinit var childRepository: ChildrenRepository
    private val viewModel: ChildFormViewModel by activityViewModels {
        ChildFormViewModelFactory(childRepository)
    }

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
        return inflater.inflate(R.layout.fragment_child_from, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val remote = BackendClient.getService(requireContext())
        val db = AppDatabase.getDB(requireContext())
        val sessionManager = SessionManager(requireContext())
        childRepository = ChildrenRepositoryImpl(remote, db, sessionManager)
        view.findViewById<ComposeView>(R.id.composeView).setContent {
            Page()
        }
    }

    fun sendData() {
        viewModel.send()
        findNavController().navigate(ChildFromFragmentDirections.actionChildFromFragmentToChildrenListParentFragment())

//        lifecycleScope.launch {
//            val success = viewModel.send()
//            if (success) {
//                viewModel.reset()
//                findNavController().navigate(ChildFromFragmentDirections.actionChildFromFragmentToChildrenListParentFragment())
//            }
//        }
    }

    @Composable
    fun Page() {
        Column(
            modifier = Modifier
                .padding(15.dp)
        ) {
            AppTextField(
                text = viewModel.name,
                placeholder = "Nama Anak",
                onChange = {
                    viewModel.name = it
                    viewModel.validateName()
                },
                isEnabled = !viewModel.loading,
                imeAction = ImeAction.Done,
                keyboardActions = KeyboardActions(
                    onDone = {
                        if (viewModel.canSend()) {
                            sendData()
                        }
                    }
                )
            )

            AnimatedVisibility(
                visible = viewModel.error != null,
                modifier = Modifier
                    .padding(0.dp, 5.dp, 0.dp, 10.dp)
            ) {
                Text(
                    text = if (viewModel.error != null) {
                        viewModel.error!!
                    } else {
                        ""
                    },
                    color = Color.Red
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(
                    checked = viewModel.enableReadToMe,
                    onCheckedChange = { viewModel.enableReadToMe = it })
                Text(
                    text = "Enable Read to me",
                    modifier = Modifier
                        .clickable {
                            viewModel.enableReadToMe = !viewModel.enableReadToMe
                        }
                )
            }

            DeleteConfirmationDialog(
                text = "Apakah kamu yakin akan menghapus ${viewModel.name}",
                title = "Konfirmasi Hapus",
                isOpen = viewModel.deleteDialogOpen,
                onDismiss = { viewModel.deleteDialogOpen = false },
                onSubmit = {
                    lifecycleScope.launch {
                        viewModel.delete()
                        findNavController().navigate(ChildFromFragmentDirections.actionChildFromFragmentToChildrenListParentFragment())
                    }
                }
            )

            Row {
                Button(
                    onClick = {
                        sendData()
                    },
                    enabled = viewModel.error == null && !viewModel.loading,
                    modifier = Modifier
                        .padding(0.dp, 0.dp, 5.dp, 0.dp)
                ) {
                    Text(text = "Simpan")
                }

                if (viewModel.childId != null) {
                    Button(
                        onClick = {
                            viewModel.deleteDialogOpen = true
                        },
                        colors = ButtonDefaults.buttonColors(backgroundColor = Color.Red),
                        modifier = Modifier
                            .padding(5.dp, 0.dp, 0.dp, 0.dp)
                    ) {
                        Text(text = "Hapus")
                    }
                }
            }
        }

    }

    @Composable
    fun AppTextField(
        modifier: Modifier = Modifier,
        text: String,
        placeholder: String,
        onChange: (String) -> Unit = {},
        imeAction: ImeAction = ImeAction.Next,
        keyboardType: KeyboardType = KeyboardType.Text,
        keyboardActions: KeyboardActions = KeyboardActions(),
        isEnabled: Boolean = true
    ) {

        OutlinedTextField(
            value = text,
            onValueChange = onChange,
            modifier = modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(imeAction = imeAction, keyboardType = keyboardType),
            keyboardActions = keyboardActions,
            enabled = isEnabled,
            placeholder = {
                Text(
                    text = placeholder,
                    style = TextStyle(fontSize = 18.sp, color = Color.LightGray)
                )
            }
        )

    }

    @Composable
    fun DeleteConfirmationDialog(
        text: String,
        title: String,
        onSubmit: () -> Unit = {},
        onDismiss: () -> Unit = {},
        isOpen: Boolean = false
    ) {
        AnimatedVisibility(visible = isOpen) {
            AlertDialog(
                onDismissRequest = onDismiss,
                title = { Text(text = title) },
                text = { Text(text = text) },
                confirmButton = {
                    Button(
                        onClick = onSubmit
                    ) {
                        Text("Ok")
                    }
                },
                dismissButton = {
                    Button(
                        onClick = onDismiss
                    ) {
                        Text("Batal")
                    }
                }
            )

        }
    }

    companion object {
        /**
         * Use this factory method to create a new instance of
         * this fragment using the provided parameters.
         *
         * @param param1 Parameter 1.
         * @param param2 Parameter 2.
         * @return A new instance of fragment ChildFromFragment.
         */
        // TODO: Rename and change types and number of parameters
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            ChildFromFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }
}