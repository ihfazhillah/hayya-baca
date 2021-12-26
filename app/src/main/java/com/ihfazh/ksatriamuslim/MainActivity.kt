package com.ihfazh.ksatriamuslim

import android.os.Bundle
import android.view.KeyEvent
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment

class MainActivity : AppCompatActivity() {
    lateinit var navController: NavController


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val navHostFragment = supportFragmentManager.findFragmentById(R.id.main_nav_host) as NavHostFragment
        navController = navHostFragment.navController

        navController.addOnDestinationChangedListener { _, destination, _ ->
            if (destination.id == R.id.readerFragment) {
                supportActionBar?.hide()
            } else {
                supportActionBar?.show()
            }
        }

//        val repo = SpeakWordRepositoryImpl(applicationContext, Client.getService())
//        lifecycleScope.launch{
//            repo.saveAudios()
//        }


//
//        val bottomNav = findViewById<BottomNavigationView>(R.id.bottom_nav)
//        bottomNav.setupWithNavController(navController)
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return super.onCreateOptionsMenu(menu)
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        navController.navigate(item.itemId)
        return true
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        val fragmentsCannotBack = listOf(
            R.id.readerFragment,
            R.id.coinCongratulateFragment
        )
        val child = navController.currentDestination?.id
        if (fragmentsCannotBack.contains(child) && keyCode == KeyEvent.KEYCODE_BACK){
            return false
        }

        return super.onKeyDown(keyCode, event)
    }
}