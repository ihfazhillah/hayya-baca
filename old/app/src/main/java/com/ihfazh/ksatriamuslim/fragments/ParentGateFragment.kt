package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.databinding.FragmentParentGateBinding
import kotlin.math.roundToInt

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

/**
 * A simple [Fragment] subclass.
 * Use the [ParentGateFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class ParentGateFragment : Fragment() {
    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null
    private lateinit var binding: FragmentParentGateBinding
    private val args by navArgs<ParentGateFragmentArgs>()

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
        binding = FragmentParentGateBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val savedStateHandle = findNavController().previousBackStackEntry!!.savedStateHandle
        savedStateHandle.set(IS_PERMISSIBLE, false)
        binding.composeView.setContent {
            Greeting {
                if (args.shouldPopBackstack) {
                    Log.d("PARENT", "onViewCreated: shouldpopbackstack $args")
                    savedStateHandle.set(IS_PERMISSIBLE, true)
                    findNavController().popBackStack()
                } else {
                    Log.d("PARENT", "onViewCreated: shouldpopbackstack $args")
                    findNavController().navigate(it)
                }
            }
        }
    }

    @OptIn(ExperimentalMaterialApi::class)
    @Composable
   fun Greeting(onNavigate: (Int) -> Unit){
        val swipeableState = rememberSwipeableState(
            initialValue = 0,
        ) {
            if (it == 1){
                onNavigate(R.id.aboutFragment)
            }
            true
        }

        val directions = listOf("KANAN", "BAWAH")
        val selectedDirection = directions.random()
        val orientation = if (selectedDirection === "KANAN"){
            Orientation.Horizontal
        } else {
            Orientation.Vertical
        }

        val anchors = mapOf(0f to 0, 300f to 1)

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Image(
                painter= painterResource(id = R.drawable.padlock_with_key),
                contentDescription = "padlock",
                modifier = Modifier
                    .size(Dp(300f))
                    .clip(CircleShape)
                    .border(5.dp, MaterialTheme.colors.secondary, CircleShape)
                    .swipeable(
                        state = swipeableState,
                        anchors = anchors,
                        orientation = orientation,
                    )
                    .offset {
                        if (selectedDirection === "KANAN") {
                            IntOffset(swipeableState.offset.value.roundToInt(), 0)
                        } else {
                            IntOffset(0, swipeableState.offset.value.roundToInt())
                        }
                    }
            )

            Spacer(
                modifier = Modifier.width(15.dp)
            )

            Column(
                modifier = Modifier
                    .wrapContentHeight(Alignment.CenterVertically)
                    .fillMaxHeight(),
                verticalArrangement = Arrangement.Center
            ){
                Text(
                    text="Hai orang tua",
                    style= MaterialTheme.typography.h4,
                )
                Spacer(modifier = Modifier.height(5.dp))
                Text(
                    text="Geser gembok ke $selectedDirection untuk masuk sebagai orang tua.",
                    style=MaterialTheme.typography.subtitle1,
                )

            }

        }
    }

    @Preview
    @Composable
    fun previewGreeting(){
        Greeting{
            findNavController().navigate(it)
        }
    }

    companion object {
        const val IS_PERMISSIBLE = "isPermissible"
        /**
         * Use this factory method to create a new instance of
         * this fragment using the provided parameters.
         *
         * @param param1 Parameter 1.
         * @param param2 Parameter 2.
         * @return A new instance of fragment ParentGateFragment.
         */
        // TODO: Rename and change types and number of parameters
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            ParentGateFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }
}