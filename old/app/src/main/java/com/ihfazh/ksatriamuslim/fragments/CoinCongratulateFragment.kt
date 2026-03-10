package com.ihfazh.ksatriamuslim.fragments

import android.media.MediaPlayer
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.addCallback
import androidx.constraintlayout.motion.widget.MotionLayout
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.common.fragment.BaseFragment
import com.ihfazh.ksatriamuslim.databinding.FragmentCoinCongratulateBinding
import com.ihfazh.ksatriamuslim.repositories.CongratulateAudioRepositoryImpl

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

/**
 * A simple [Fragment] subclass.
 * Use the [CoinCongratulateFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class CoinCongratulateFragment : BaseFragment() {
    override fun canBack(): Boolean = false

    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null
    private lateinit var mediaPlayer: MediaPlayer
    private lateinit var binding: FragmentCoinCongratulateBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.let {
            param1 = it.getString(ARG_PARAM1)
            param2 = it.getString(ARG_PARAM2)
        }
        requireActivity().onBackPressedDispatcher.addCallback(this){
            isEnabled = false
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        binding = FragmentCoinCongratulateBinding.inflate(
            inflater, container, false
        ).apply {

        }
        return binding.root
    }


    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val audioRepository = CongratulateAudioRepositoryImpl()

        lifecycleScope.launchWhenCreated {
            mediaPlayer =
                MediaPlayer.create(requireContext(), audioRepository.getRandomAudio()).apply {
                    setOnCompletionListener {
                        it.release()
                    }
                }
            mediaPlayer.start()
        }

        val motion = view.findViewById<MotionLayout>(R.id.constraintLayout)
        val transitionListiner = object : MotionLayout.TransitionListener {
            override fun onTransitionStarted(
                motionLayout: MotionLayout?,
                startId: Int,
                endId: Int
            ) {
            }

            override fun onTransitionChange(
                motionLayout: MotionLayout?,
                startId: Int,
                endId: Int,
                progress: Float
            ) {
            }

            override fun onTransitionCompleted(motionLayout: MotionLayout?, currentId: Int) {
                if (currentId == R.id.end) {
                    val mp = MediaPlayer.create(context, R.raw.clinking_coin).apply {
                        setOnCompletionListener {
                            it.release()
                        }
                    }
                    mp?.start()

                    val direction =
                        CoinCongratulateFragmentDirections.actionCoinCongratulateFragmentToHomeFragment()
                    findNavController().navigate(direction)
                }
            }

            override fun onTransitionTrigger(
                motionLayout: MotionLayout?,
                triggerId: Int,
                positive: Boolean,
                progress: Float
            ) {
            }
        }

        motion.apply {
            setTransitionListener(transitionListiner)
        }

    }

    companion object {
        /**
         * Use this factory method to create a new instance of
         * this fragment using the provided parameters.
         *
         * @param param1 Parameter 1.
         * @param param2 Parameter 2.
         * @return A new instance of fragment CoinCongratulateFragment.
         */
        // TODO: Rename and change types and number of parameters
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            CoinCongratulateFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }
}