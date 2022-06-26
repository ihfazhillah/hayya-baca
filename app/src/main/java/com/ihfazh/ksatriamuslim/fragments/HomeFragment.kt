package com.ihfazh.ksatriamuslim.fragments

import android.app.AlertDialog
import android.graphics.Color
import android.graphics.Rect
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.OnBackPressedCallback
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.avatarfirst.avatargenlib.AvatarGenerator
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.adapters.BookRecyclerViewAdapter
import com.ihfazh.ksatriamuslim.databinding.FragmentHomeBinding
import com.ihfazh.ksatriamuslim.domain.BookUI
import com.ihfazh.ksatriamuslim.domain.Children
import com.ihfazh.ksatriamuslim.vm.*
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import org.koin.androidx.viewmodel.ext.android.sharedViewModel

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
    private val homeVM: HomeViewModel by sharedViewModel()

    val childVM: ChildViewModel by sharedViewModel()

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
            vm = homeVM
            gameBtn.setOnClickListener {
                findNavController().navigate(
                    R.id.goToApplicationListChild
                )
            }
        }


        val rvAdapter = BookRecyclerViewAdapter(BookUIComparator) { view, book ->
            if (!book.gift_opened) {
                homeVM.openGift(book.id)
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

        viewLifecycleOwner.lifecycleScope.launch {
            homeVM.books.collectLatest {
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

    private fun setAvatar(children: Children) {
        if (children.picture == null) {
            val avatar = AvatarGenerator.AvatarBuilder(requireContext())
                .setLabel(children.name.take(1))
                .setAvatarSize(40)
                .setTextSize(15)
                .toCircle()
                .setBackgroundColor(Color.RED)
                .build()

            binding.avatar.load(avatar)
        } else {
            binding.avatar.load(children.picture) {
                crossfade(true)
                transformations(CircleCropTransformation())
            }
        }
        binding.avatar.setOnClickListener {
            lifecycleScope.launch {
//                childVM.setSelectedChild(null)
                findNavController().navigate(HomeFragmentDirections.actionHomeFragmentToChildrenListChildFragment())
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

        childVM.child.observe(viewLifecycleOwner) {
            binding.starLayout.children = it
            if (it != null) {
                homeVM.children.value = it
                setAvatar(it)
            }
        }
        initializeStar()

        val onBackPressedCallback = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val builder = AlertDialog.Builder(requireContext())
                    .setMessage("Yakin mau keluar ??")
                    .setTitle("Konfirmasi Keluar")
                    .setPositiveButton("Ya") { dialog, id ->
//                        childVM.setChildNull()
                        dialog.dismiss()
                        requireActivity().finish()
                    }
                    .setNegativeButton("Tidak") { dialog, id ->
                        dialog.dismiss()
                    }
                builder.create().show()
            }
        }
        requireActivity().onBackPressedDispatcher.addCallback(
            viewLifecycleOwner,
            onBackPressedCallback
        )
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