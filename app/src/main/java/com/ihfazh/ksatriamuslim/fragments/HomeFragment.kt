package com.ihfazh.ksatriamuslim.fragments

import android.graphics.Color
import android.graphics.Rect
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.asFlow
import androidx.lifecycle.asLiveData
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.avatarfirst.avatargenlib.AvatarGenerator
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.adapters.BookRecyclerViewAdapter
import com.ihfazh.ksatriamuslim.common.SessionManager
import com.ihfazh.ksatriamuslim.databinding.FragmentHomeBinding
import com.ihfazh.ksatriamuslim.domain.BookUI
import com.ihfazh.ksatriamuslim.local.AppDatabase
import com.ihfazh.ksatriamuslim.remote.BackendClient
import com.ihfazh.ksatriamuslim.repositories.AuthenticationRepository
import com.ihfazh.ksatriamuslim.repositories.BackendAuthenticationRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepository
import com.ihfazh.ksatriamuslim.repositories.ChildrenRepositoryImpl
import com.ihfazh.ksatriamuslim.vm.*
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

/**
 * A simple [Fragment] subclass.
 * Use the [HomeFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
object BookUIComparator : DiffUtil.ItemCallback<BookUI>() {
    override fun areItemsTheSame(oldItem: BookUI, newItem: BookUI): Boolean {
        return oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: BookUI, newItem: BookUI): Boolean {
        return oldItem == newItem
    }
}

class HomeFragment : Fragment() {
    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null
    private val viewModel: HomeViewModel by activityViewModels()
    private lateinit var childrenRepository: ChildrenRepository

    private lateinit var authRepository: AuthenticationRepository
    private val authViewModel by activityViewModels<AuthViewModel> {
        AuthViewModelFactory(
            authRepository
        )
    }
    private val childVM: ChildViewModel by activityViewModels {
        ChildViewModelFactory(childrenRepository)
    }


    lateinit var binding: FragmentHomeBinding

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
        binding = FragmentHomeBinding.inflate(inflater, container, false).apply {
            lifecycleOwner = viewLifecycleOwner
            vm = viewModel
//            childViewModel = childVM
        }


        val rvAdapter = BookRecyclerViewAdapter(BookUIComparator) { view, book ->
            if (!book.gift_opened) {
                viewModel.openGift(book.id)
            } else {
                val action = HomeFragmentDirections.actionHomeFragmentToReaderFragment(book.id)
                findNavController().navigate(action)
            }
        }

        val spanCount = 3
        binding.bookRv.adapter = rvAdapter
        binding.bookRv.layoutManager = GridLayoutManager(context, spanCount)
        binding.bookRv.addItemDecoration(object : RecyclerView.ItemDecoration() {
            // https://stackoverflow.com/questions/28531996/android-recyclerview-gridlayoutmanager-column-spacing
            override fun getItemOffsets(
                outRect: Rect,
                view: View,
                parent: RecyclerView,
                state: RecyclerView.State
            ) {
//                super.getItemOffsets(outRect, view, parent, state)
                val position = parent.getChildAdapterPosition(view)
                val column = position % spanCount

                val spacing = 5 // in px
                val includeEdge = true

                if (includeEdge) {
                    outRect.left =
                        spacing - column * spacing / spanCount // spacing - column * ((1f / spanCount) * spacing)
                    outRect.right =
                        (column + 1) * spacing / spanCount // (column + 1) * ((1f / spanCount) * spacing)

                    if (position < spanCount) { // top edge
                        outRect.top = spacing
                    }
                    outRect.bottom = spacing // item bottom
                } else {
                    outRect.left =
                        column * spacing / spanCount // column * ((1f / spanCount) * spacing)
                    outRect.right =
                        spacing - (column + 1) * spacing / spanCount // spacing - (column + 1) * ((1f /    spanCount) * spacing)
                    if (position >= spanCount) {
                        outRect.top = spacing // item top
                    }
                }
            }
        })

//        viewModel.books.observe(viewLifecycleOwner) {
//            rvAdapter.setBooks(it)
//        }
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.books.collectLatest {
                rvAdapter.submitData(it)
            }
        }

//        initializeStar()

        binding.parentButton.setOnClickListener {
            val direction = HomeFragmentDirections.actionHomeFragmentToParentGateFragment()
            findNavController().navigate(direction)
        }


        return binding.root
    }

    private fun setAvatar(label: String) {
        val avatar = AvatarGenerator.AvatarBuilder(requireContext())
            .setLabel(label)
            .setAvatarSize(40)
            .setTextSize(15)
            .toCircle()
            .setBackgroundColor(Color.RED)
            .build()

        binding.avatar.load(avatar)
        binding.avatar.setOnClickListener {
            lifecycleScope.launch {
                childVM.setSelectedChild(null)
//                findNavController().navigate(HomeFragmentDirections.actionHomeFragmentToChildrenListChildFragment())
            }
        }

    }

    private fun initializeStar() {
        childVM.child.observe(viewLifecycleOwner) {
            it?.let { myChild ->
                binding.starLayout.children = myChild
                binding.coinLayout.children = myChild
            }

        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val remote = BackendClient.getService(requireContext())
        val sessionManager = SessionManager(requireContext())
        val db = AppDatabase.getDB(requireContext())

        authRepository = BackendAuthenticationRepository(remote, sessionManager)
        childrenRepository = ChildrenRepositoryImpl(remote, db, sessionManager)

//        authViewModel.user.observe(viewLifecycleOwner) {
//            if (it.token == null) {
//                findNavController().navigate(R.id.loginFragment)
//            }
//        }

        authViewModel.user.asFlow().combine(
            childVM.child.asFlow()
        ) { user, children ->
            when {
                user.token == null -> {
                    R.id.loginFragment
                }
                children == null -> {
                    R.id.childrenListChildFragment
                }
                else -> {
                    null
                }
            }
        }.asLiveData().observe(viewLifecycleOwner) {
            it?.let { id -> findNavController().navigate(id) }
        }

        childVM.child.observe(viewLifecycleOwner) {
            binding.starLayout.children = it
            if (it != null) {
                viewModel.children.value = it
            }
            setAvatar(it?.name?.take(1) ?: "U")
        }
        initializeStar()
    }

    companion object {
        /**
         * Use this factory method to create a new instance of
         * this fragment using the provided parameters.
         *
         * @param param1 Parameter 1.
         * @param param2 Parameter 2.
         * @return A new instance of fragment HomeFragment.
         */
        // TODO: Rename and change types and number of parameters
        const val TAG = "HomeFragment"
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            HomeFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }
}