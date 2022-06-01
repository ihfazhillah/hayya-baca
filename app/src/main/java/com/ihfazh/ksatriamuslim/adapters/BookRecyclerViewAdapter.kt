package com.ihfazh.ksatriamuslim.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ihfazh.ksatriamuslim.databinding.BookItemBinding
import com.ihfazh.ksatriamuslim.domain.BookUI

typealias listener = (view: View, book: BookUI) -> Unit


class BookViewHolder(private val binding: BookItemBinding, private val listener: listener) :
    RecyclerView.ViewHolder(binding.root) {
    fun bind(book: BookUI) {
        binding.giftOpen = book.gift_opened
        binding.title.text = if (book.gift_opened) {
            book.title
        } else "Buku Baru"

        binding.root.setOnClickListener {
            listener(it, book)
        }

        binding.cardBookItem.setOnClickListener {
            listener(it, book)
        }

        binding.imageThumbnail.load(book.book.thumbnailSrc)
    }
}

class BookRecyclerViewAdapter(val listener: listener) : RecyclerView.Adapter<BookViewHolder>() {
    private val arrayList = arrayListOf<BookUI>()
    lateinit var binding: BookItemBinding

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): BookViewHolder {
        val layoutInflater = LayoutInflater.from(parent.context)
        binding = BookItemBinding.inflate(layoutInflater, parent, false)
        return BookViewHolder(binding, listener)
    }

    override fun onBindViewHolder(holder: BookViewHolder, position: Int) {
        val book = arrayList[position]
        holder.bind(book)
    }

    override fun getItemCount(): Int = arrayList.size

    fun setBooks(books: List<BookUI>) {
        arrayList.clear()
        arrayList.addAll(books)
        notifyDataSetChanged()
    }
}