package com.ihfazh.ksatriamuslim.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.navigation.findNavController
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ihfazh.ksatriamuslim.databinding.BookItemBinding
import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookSummary
import com.ihfazh.ksatriamuslim.fragments.HomeFragmentDirections

class BookViewHolder(private val binding: BookItemBinding): RecyclerView.ViewHolder(binding.root) {
    fun bind(book: BookSummary) {
        binding.title.text = book.title
        binding.root.setOnClickListener{
            val action = HomeFragmentDirections.actionHomeFragmentToReaderFragment(book.id)
            it.findNavController().navigate(action)
        }

        val url = "https://ksatriamuslim.com/${book.thumbnailSrc}"
        binding.imageThumbnail.load(url)
    }
}

class BookRecyclerViewAdapter: RecyclerView.Adapter<BookViewHolder>() {
    private val arrayList = arrayListOf<BookSummary>()
    lateinit var binding: BookItemBinding

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): BookViewHolder {
        val layoutInflater = LayoutInflater.from(parent.context)
        binding = BookItemBinding.inflate(layoutInflater, parent, false)
        return BookViewHolder(binding)
    }

    override fun onBindViewHolder(holder: BookViewHolder, position: Int) {
        val book = arrayList[position]
        holder.bind(book)
    }

    override fun getItemCount(): Int {
        return arrayList.size }

    fun setBooks(books: List<BookSummary>){
        arrayList.clear()
        arrayList.addAll(books)
        notifyDataSetChanged()
    }
}