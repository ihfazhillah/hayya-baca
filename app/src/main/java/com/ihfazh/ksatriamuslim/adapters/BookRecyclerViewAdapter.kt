package com.ihfazh.ksatriamuslim.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.navigation.findNavController
import androidx.recyclerview.widget.RecyclerView
import com.ihfazh.ksatriamuslim.databinding.BookItemBinding
import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.fragments.HomeFragmentDirections

class BookViewHolder(private val binding: BookItemBinding): RecyclerView.ViewHolder(binding.root) {
    fun bind(book: Book) {
        binding.title.text = book.title
        binding.root.setOnClickListener{
            val action = HomeFragmentDirections.actionHomeFragmentToReaderFragment(book.id)
            it.findNavController().navigate(action)
        }
    }
}

class BookRecyclerViewAdapter: RecyclerView.Adapter<BookViewHolder>() {
    private val arrayList = arrayListOf<Book>()
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

    fun setBooks(books: List<Book>){
        arrayList.clear()
        arrayList.addAll(books)
        notifyDataSetChanged()
    }
}