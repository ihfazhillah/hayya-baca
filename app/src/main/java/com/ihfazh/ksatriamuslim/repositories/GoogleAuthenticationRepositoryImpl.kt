package com.ihfazh.ksatriamuslim.repositories

import android.content.Context
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions

class GoogleAuthenticationRepositoryImpl(val context: Context): AuthenticationRepository {
    private  var googleSigninOptions: GoogleSignInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .build()
    val googleClient: GoogleSignInClient = GoogleSignIn.getClient(context, googleSigninOptions)

    override fun isLoggedIn(): Boolean {
        return GoogleSignIn.getLastSignedInAccount(context) != null
    }
}