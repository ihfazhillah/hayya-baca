package com.ihfazh.ksatriamuslim.repositories

import android.content.Context
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase
import com.ihfazh.ksatriamuslim.R
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class GoogleAuthenticationRepositoryImpl(val context: Context): AuthenticationRepository {
    val auth = Firebase.auth.apply {
        addAuthStateListener{
            println("get user: ${it.currentUser}")
        }
    }




    private  var googleSigninOptions: GoogleSignInOptions = GoogleSignInOptions
        .Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestIdToken(context.getString(R.string.default_web_client_id))
        .requestEmail()
        .build()
    val googleClient: GoogleSignInClient = GoogleSignIn.getClient(context, googleSigninOptions)

    override suspend fun isLoggedIn(): Boolean {
        val googleSigninAccount = GoogleSignIn.getLastSignedInAccount(context)
        if (googleSigninAccount != null){
            val firebaseUser = firebaseLogin(googleSigninAccount.idToken!!)
            return firebaseUser != null
        }
        return false
    }

    suspend fun firebaseLogin(idToken: String): FirebaseUser?{
        return suspendCoroutine { con ->
            val credential = GoogleAuthProvider.getCredential(idToken, null)
            auth.signInWithCredential(credential)
                .addOnCompleteListener {
                    if (it.isSuccessful){
                        con.resume(it.result.user)
                    } else {
                        println("Something error with the authentication -- ${it.result}")
                        con.resume(null)
                    }
                }
        }
    }

    override fun signOut(){
        auth.signOut()
        GoogleSignIn.getClient(context.applicationContext, GoogleSignInOptions.DEFAULT_SIGN_IN).signOut()
    }
}