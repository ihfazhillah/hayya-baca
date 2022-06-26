package com.ihfazh.ksatriamuslim.fragments

import android.graphics.Rect
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.adapters.PhotoListener
import com.ihfazh.ksatriamuslim.adapters.PhotoProfileRecyclerViewAdapter
import com.ihfazh.ksatriamuslim.databinding.FragmentPhotoProfilePickerBinding
import com.ihfazh.ksatriamuslim.domain.Picture
import com.ihfazh.ksatriamuslim.vm.PhotoProfilePickerViewModel
import org.koin.androidx.viewmodel.ext.android.viewModel

// TODO: Rename parameter arguments, choose names that match
// the fragment initialization parameters, e.g. ARG_ITEM_NUMBER
private const val ARG_PARAM1 = "param1"
private const val ARG_PARAM2 = "param2"

object PhotoProfileComparator : DiffUtil.ItemCallback<Picture>() {
    override fun areItemsTheSame(oldItem: Picture, newItem: Picture): Boolean {
        return oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: Picture, newItem: Picture): Boolean {
        return oldItem == newItem
    }
}

class MarginPhotoDecoration : RecyclerView.ItemDecoration() {
    override fun getItemOffsets(
        outRect: Rect,
        view: View,
        parent: RecyclerView,
        state: RecyclerView.State
    ) {
        with(outRect) {
            if (parent.getChildAdapterPosition(view) == 0) {
                left = 16
            }
            top = 16
            bottom = 16
            right = 16
        }
    }
}

/**
 * A simple [Fragment] subclass.
 * Use the [PhotoProfilePickerFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class PhotoProfilePickerFragment : Fragment() {
    // TODO: Rename and change types of parameters
    private var param1: String? = null
    private var param2: String? = null

    private val photoPickerVM: PhotoProfilePickerViewModel by viewModel()
    private var binding: FragmentPhotoProfilePickerBinding? = null
    private val args: PhotoProfilePickerFragmentArgs by navArgs()

    override fun onCreate(savedInstanceState: Bundle?) {
        photoPickerVM.setChild(args.childId.toString())
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
        binding = FragmentPhotoProfilePickerBinding.inflate(
            inflater, container, false
        )
        return binding?.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val photoAdapter = PhotoProfileRecyclerViewAdapter(
            PhotoProfileComparator,
            object : PhotoListener {
                override fun onClick(picture: Picture) {
                    photoPickerVM.updatePic(picture)
                }
            }
        )

        binding?.let { b ->
            photoPickerVM.currentState.observe(viewLifecycleOwner) {
                if (it.selectedPhoto != null) {
                    b.profile.load(it.selectedPhoto.photo) {
                        transformations(CircleCropTransformation())
                    }
                } else {
                    b.profile.load(R.drawable.ic_baseline_person_24) {
                        transformations(CircleCropTransformation())
                    }
                }

                if (it.photos != null) {
                    photoAdapter.submitData(viewLifecycleOwner.lifecycle, it.photos)
                }
            }

            b.back.setOnClickListener {
                findNavController().navigateUp()
            }

            b.photos.adapter = photoAdapter
            b.photos.layoutManager =
                LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)

            b.photos.addItemDecoration(
                MarginPhotoDecoration()
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
         * @return A new instance of fragment PhotoProfilePickerFragment.
         */
        // TODO: Rename and change types and number of parameters
        @JvmStatic
        fun newInstance(param1: String, param2: String) =
            PhotoProfilePickerFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_PARAM1, param1)
                    putString(ARG_PARAM2, param2)
                }
            }
    }

    override fun onDestroy() {
        super.onDestroy()
        binding = null
    }
}