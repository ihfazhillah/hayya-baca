package com.ihfazh.ksatriamuslim.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.paging.PagingDataAdapter
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.ihfazh.ksatriamuslim.databinding.ItemPhotoProfileBinding
import com.ihfazh.ksatriamuslim.domain.Picture

//typealias listener = (view: View, book: BookUI) -> Unit

interface PhotoListener {
    fun onClick(picture: Picture)
}


class PhotoProfileViewHolder(
    private val binding: ItemPhotoProfileBinding,
    private val listener: PhotoListener
) :
    RecyclerView.ViewHolder(binding.root) {
    fun bind(picture: Picture) {
        binding.img.load(picture.photo) {
            transformations(CircleCropTransformation())
                .crossfade(true)
        }

        binding.root.setOnClickListener {
            listener.onClick(picture)
        }
    }
}

class PhotoProfileRecyclerViewAdapter(
    diffCallback: DiffUtil.ItemCallback<Picture>,
    val listener: PhotoListener
) :
    PagingDataAdapter<Picture, PhotoProfileViewHolder>(diffCallback) {

    //    private val arrayList = arrayListOf<BookUI>()
    lateinit var binding: ItemPhotoProfileBinding

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PhotoProfileViewHolder {
        val layoutInflater = LayoutInflater.from(parent.context)
        binding = ItemPhotoProfileBinding.inflate(layoutInflater, parent, false)
        return PhotoProfileViewHolder(binding, listener)
    }

    override fun onBindViewHolder(holder: PhotoProfileViewHolder, position: Int) {
        getItem(position)?.let { photo ->
            holder.bind(photo)
        }
    }
}