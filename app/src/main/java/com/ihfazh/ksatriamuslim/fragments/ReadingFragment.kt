package com.ihfazh.ksatriamuslim.fragments

import android.Manifest
import android.animation.Animator
import android.os.Bundle
import android.text.method.LinkMovementMethod
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.ihfazh.ksatriamuslim.common.Navigator
import com.ihfazh.ksatriamuslim.common.Recognizer
import com.ihfazh.ksatriamuslim.common.VoiceStreamer
import com.ihfazh.ksatriamuslim.common.fragment.BaseFragment
import com.ihfazh.ksatriamuslim.databinding.FragmentReadingBinding
import com.ihfazh.ksatriamuslim.vm.KoinViewModel
import com.ihfazh.ksatriamuslim.vm.ReadingViewModel
import com.ihfazh.ksatriamuslim.vm.StarViewModel
import com.microsoft.cognitiveservices.speech.audio.*
import me.xdrop.fuzzywuzzy.FuzzySearch

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

/**
 * A simple [Fragment] subclass.
 * Use the [ReadingFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class ReadingFragment : BaseFragment() {

    val showFragment = false

    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null
    private val args: ReadingFragmentArgs by navArgs()

    private val viewModel: ReadingViewModel by viewModels()
    private val koinViewModel: KoinViewModel by activityViewModels()
    private val starViewModel: StarViewModel by activityViewModels()

    private lateinit var navigator: Navigator
    private lateinit var binding: FragmentReadingBinding

    private var voiceStreamer: VoiceStreamer? = null

    private val recordPermission = Manifest.permission.RECORD_AUDIO
    private val askPermissionContract =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
            if (ok) {
                startVoiceStreamer()
            } else {
                Log.w(TAG, "Permission not granted. Skipping..")

            }
        }

    private fun startVoiceStreamer() {
        voiceStreamer = VoiceStreamer().apply {
            onVoiceAvailable = {
                Recognizer.feedAudio(it)
            }
            onStreamingFinished = {
            }
        }

        voiceStreamer?.startVoiceStreaming()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.let {
            param1 = it.getString(ARG_PARAM1)
            param2 = it.getString(ARG_PARAM2)
        }
        requireActivity().onBackPressedDispatcher.addCallback(this) {
            isEnabled = false
        }
        askPermissionContract.launch(recordPermission)
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        // Inflate the layout for this fragment
        binding = FragmentReadingBinding.inflate(layoutInflater, container, false).apply {
            vm = viewModel
            lifecycleOwner = viewLifecycleOwner
            mainText.movementMethod = LinkMovementMethod.getInstance()

            loading.addAnimatorListener(object: Animator.AnimatorListener{
                override fun onAnimationStart(p0: Animator?) {
                    viewModel.animationRunning.value = true
                }

                override fun onAnimationEnd(p0: Animator?) {
                    viewModel.animationRunning.value = false
                }

                override fun onAnimationCancel(p0: Animator?) {
                    viewModel.animationRunning.value = false
                }

                override fun onAnimationRepeat(p0: Animator?) {
                    viewModel.animationRunning.value = false
                }
            })
        }

        viewModel.bookId.value = args.bookId
        viewModel.isFinish.observe(viewLifecycleOwner) {
            if (it) {
                voiceStreamer?.stopVoiceStreaming()
            }
        }
        viewModel.page.observe(viewLifecycleOwner) {
            voiceStreamer?.stopVoiceStreaming()
            voiceStreamer?.startVoiceStreaming()
        }

        Recognizer.onRecognized = { text ->
            val page = viewModel.textPage.value
            if (page != null) {
                Log.d(TAG, "Text from recognized: $text")
                val extracted = FuzzySearch.extractAll(text, page.words) { it.text }
                val words = (page.words zip extracted).map {
                    val word = it.first
                    val result = it.second
                    Log.d(TAG, "Result: $result")

                    if (result.score >= 60) {
                        word.copy(isRead = true)
                    } else {
                        word
                    }
                }

                viewModel.textPage.postValue(page.copy(words = words))
            }
        }

        initializeStarAndCoin()

        return binding.root
    }

    private fun initializeStarAndCoin() {
        binding.coinLayout.coin = koinViewModel
        binding.starLayout.star = starViewModel
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        navigator = Navigator(view, lifecycleScope)
        binding.nav = navigator

        viewModel.isFinish.observe(viewLifecycleOwner) { finished ->
            if (finished) {
                koinViewModel.increaseMyCoin()
                val action =
                    ReadingFragmentDirections.actionReaderFragmentToCoinCongratulateFragment()
                findNavController().navigate(action)
            }
        }

    }



    override fun getShowStatusBarStatus(): Boolean = false

    companion object {
        /**
         * Use this factory method to create a new instance of
         * this fragment using the provided parameters.
         *
         * @param param1 Parameter 1.
         * @param param2 Parameter 2.
         * @return A new instance of fragment ReadingFragment.
         */
        // TODO: Rename and change types and number of parameters
        const val TAG = "Fragment Reading"
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            ReadingFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }

    override fun onDestroy() {
        viewModel.releaseWordSpeak()
//        voiceStreamer?.stopVoiceStreaming()
        super.onDestroy()
    }

    override fun onDetach() {
        super.onDetach()
        voiceStreamer?.stopVoiceStreaming()
    }

}