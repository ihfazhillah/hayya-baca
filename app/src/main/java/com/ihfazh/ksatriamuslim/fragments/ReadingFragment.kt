package com.ihfazh.ksatriamuslim.fragments

import android.animation.Animator
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.os.Bundle
import android.text.method.LinkMovementMethod
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.addCallback
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.ihfazh.ksatriamuslim.common.Constants
import com.ihfazh.ksatriamuslim.common.Navigator
import com.ihfazh.ksatriamuslim.common.Recognizer
import com.ihfazh.ksatriamuslim.common.RecognizerListener
import com.ihfazh.ksatriamuslim.common.fragment.BaseFragment
import com.ihfazh.ksatriamuslim.databinding.FragmentReadingBinding
import com.ihfazh.ksatriamuslim.vm.KoinViewModel
import com.ihfazh.ksatriamuslim.vm.ReadingViewModel
import com.ihfazh.ksatriamuslim.vm.StarViewModel
import com.microsoft.cognitiveservices.speech.audio.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

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


    private var param1: String? = null
    private var param2: String? = null
    private val args: ReadingFragmentArgs by navArgs()

    private val viewModel: ReadingViewModel by viewModels()
    private val koinViewModel: KoinViewModel by activityViewModels()
    private val starViewModel: StarViewModel by activityViewModels()

    private lateinit var navigator: Navigator
    private lateinit var binding: FragmentReadingBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.let {
            param1 = it.getString(ARG_PARAM1)
            param2 = it.getString(ARG_PARAM2)
        }
        requireActivity().onBackPressedDispatcher.addCallback(this) {
            isEnabled = false
        }

        lifecycleScope.launch(Dispatchers.IO) {
            Recognizer.startRecognizing()
        }
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


        initializeStarAndCoin()

        return binding.root
    }

    private fun initiateSpeechRecognizerAndListener() {
        Recognizer.onRecognized = { text ->
            viewModel.textPage.value?.let {
                val result = RecognizerListener.flipIsRead(it, text)
                viewModel.textPage.postValue(result)
                viewModel.canMove.value = true
            }
        }

        Recognizer.onRecognizing = { text ->
            viewModel.canMove.value = false
            viewModel.textPage.value?.let {
                val result = RecognizerListener.flipIsRead(it, text)
                viewModel.textPage.postValue(result)
            }
        }

        Recognizer.onCanceled = {
            lifecycleScope.launch(Dispatchers.IO) {
                Recognizer.startRecognizing()
            }
        }

        viewModel.page.observe(viewLifecycleOwner) {
            viewModel.textPage.value?.let { currentTextPage ->
                val percentage = RecognizerListener.calculatePercentage(currentTextPage)
                animatePercentChange(percentage * 100)

            }
        }

        viewModel.textPage.observe(viewLifecycleOwner) {
            Recognizer.addPhrase(it.originalText)
        }
    }


    private fun initializeStarAndCoin() {
//        binding.coinLayout.coin = koinViewModel
//        binding.starLayout.star = starViewModel
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        navigator = Navigator(view, lifecycleScope)
        binding.nav = navigator

        viewModel.isFinish.observe(viewLifecycleOwner) { finished ->
            if (finished) {
                viewModel.calculatePercentage()
                koinViewModel.increaseMyCoin()
                val action =
                    ReadingFragmentDirections.actionReaderFragmentToCoinCongratulateFragment()
                findNavController().navigate(action)
                lifecycleScope.launch {
                    Recognizer.stopRecognizing()
                }
            }
        }

        if (!Constants.isTvVersion(requireContext())) {
            initiateSpeechRecognizerAndListener()
        } else {
            binding.toggleMicBtn.visibility = View.GONE
        }

    }

    private fun animatePercentChange(percent: Float) {
        val incrementor = when {
            percent >= 75 -> 4
            percent >= 50 -> 3
            percent >= 25 -> 2
            percent >= 1 -> 1
            else -> 0
        }
        starViewModel.increaseMyCoin(incrementor)


        if (incrementor > 0) {
            binding.starAddedTv.text = "+$incrementor"
            binding.starAddedTv.visibility = View.VISIBLE
            val horizontalPositionAnim =
                ObjectAnimator.ofFloat(binding.starAddedTv, "translationX", 0f, 1000f)
            val topPositionAnim =
                ObjectAnimator.ofFloat(binding.starAddedTv, "translationY", 0f, -1000f)
            val scaleX = ObjectAnimator.ofFloat(binding.starAddedTv, "scaleX", 1f, 0f)
            val scaleY = ObjectAnimator.ofFloat(binding.starAddedTv, "scaleY", 1f, 0f)
            val set = AnimatorSet()
            set.duration = 1000
            set.playTogether(topPositionAnim, horizontalPositionAnim, scaleX, scaleY)
            set.start()
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
        super.onDestroy()
    }

}