package com.ihfazh.ksatriamuslim.fragments

import android.Manifest
import android.animation.Animator
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.os.Bundle
import android.text.method.LinkMovementMethod
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import coil.load
import com.ihfazh.ksatriamuslim.activities.MainActivity
import com.ihfazh.ksatriamuslim.common.*
import com.ihfazh.ksatriamuslim.common.fragment.BaseFragment
import com.ihfazh.ksatriamuslim.databinding.FragmentReadingBinding
import com.ihfazh.ksatriamuslim.domain.ReadingScreenState
import com.ihfazh.ksatriamuslim.vm.ChildViewModel
import com.ihfazh.ksatriamuslim.vm.ReadingViewModel
import com.microsoft.cognitiveservices.speech.audio.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import org.koin.android.ext.android.inject
import org.koin.androidx.viewmodel.ext.android.sharedViewModel
import org.koin.androidx.viewmodel.ext.android.viewModel

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

    private val viewModel: ReadingViewModel by viewModel()
    private val childViewModel: ChildViewModel by sharedViewModel()
    private val wordSpeak: WordSpeak by inject()

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

        if (!childViewModel.child.value!!.enableReadToMe) {
            lifecycleScope.launch(Dispatchers.IO) {
                Recognizer.startRecognizing()
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        viewModel.setBook(args.bookId)
        viewModel.getBackground()
        // Inflate the layout for this fragment
        binding = FragmentReadingBinding.inflate(layoutInflater, container, false).apply {
            lifecycleOwner = viewLifecycleOwner

            mainText.movementMethod = LinkMovementMethod.getInstance()

            loading.addAnimatorListener(object : Animator.AnimatorListener {
                override fun onAnimationStart(p0: Animator?) {
                    viewModel.setAnimationRunning(true)
                }

                override fun onAnimationEnd(p0: Animator?) {
                    viewModel.setAnimationRunning(false)
                }

                override fun onAnimationCancel(p0: Animator?) {
                    viewModel.setAnimationRunning(false)
                }

                override fun onAnimationRepeat(p0: Animator?) {
                    viewModel.setAnimationRunning(false)
                }
            })

            nextIcon.setOnClickListener {
                viewModel.nextPage()
                if (childViewModel.child.value!!.enableReadToMe) {
                    viewModel.readPage()
                }
            }

            prevIcon.setOnClickListener {
                viewModel.prevPage()
                if (childViewModel.child.value!!.enableReadToMe) {
                    viewModel.readPage()
                }
            }
            btnHome.setOnClickListener {
                navigator.goHome()
            }
        }

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


        viewModel.textPage.observe(viewLifecycleOwner) {
            Recognizer.addPhrase(it.originalText)
        }
    }


    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        if (!Constants.isTvVersion(requireContext())) {
            askPermissionContract.launch(permission)
        }
        navigator = Navigator(view, lifecycleScope)

        viewModel.state.observe(viewLifecycleOwner) { state ->
            if (state != null) {
                updateScreen(state, binding)
            }
        }
    }

    // handle background set flag
    private var backgroundSet = false
    private fun updateScreen(state: ReadingScreenState, binding: FragmentReadingBinding) {

        if (state.isReady()) {
            binding.loading.visibility = View.INVISIBLE
        } else {
            viewModel.readiness()
            return
        }

        binding.pageNumber.setTextColor(state.textColor!!)
        binding.pageNumber.text = state.currentPage!!.toString()

        binding.mainText.text = state.currentText!!
        binding.mainText.setTextColor(state.textColor)
        if (!backgroundSet) {
            binding.backgroundImage.load(state.backgroundImage!!)
            backgroundSet = true
        }

        binding.root.setOnClickListener {
            if (childViewModel.child.value!!.enableReadToMe) {
                wordSpeak.speakPage(
                    viewModel.bookId.value!!,
                    state.currentPage,
                    state.currentText
                )
            }
        }


        if (state.isFinish) {
            viewModel.calculatePercentage()
            childViewModel.increaseMyCoin(viewModel.bookId.value)
            val action =
                ReadingFragmentDirections.actionReaderFragmentToCoinCongratulateFragment()
            findNavController().navigate(action)
            lifecycleScope.launch { Recognizer.stopRecognizing() }
        }

    }


    private fun animatePercentChange(percent: Float) {
        val incrementor = when {
            percent >= 75 -> 4L
            percent >= 50 -> 3L
            percent >= 25 -> 2L
            percent >= 1 -> 1L
            else -> 0L
        }
        childViewModel.increaseMyStar(viewModel.bookId.value, viewModel.page.value, incrementor)


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
        wordSpeak.release()
        super.onDestroy()
    }

    // PERMISSIONS
    private val permission = Manifest.permission.RECORD_AUDIO
    private val askPermissionContract =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            if (it) {
                Recognizer.initialize()
            } else {
                Log.w(MainActivity.TAG, "Permission not granted. Recording not started.")
            }
        }

}