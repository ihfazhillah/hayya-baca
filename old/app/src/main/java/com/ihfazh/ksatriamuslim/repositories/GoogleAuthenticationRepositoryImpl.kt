package com.ihfazh.ksatriamuslim.repositories

//class GoogleAuthenticationRepositoryImpl(val context: Context): AuthenticationRepository {
//    val auth = Firebase.auth.apply {
//        addAuthStateListener {
//            println("get user: ${it.currentUser}")
//        }
//    }
//
//    companion object {
//        const val TAG = "Google authentication Repository Impl"
//    }
//
//
//    private var googleSigninOptions: GoogleSignInOptions = GoogleSignInOptions
//        .Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
//        .requestIdToken(context.getString(R.string.default_web_client_id))
//        .requestEmail()
//        .build()
//    val googleClient: GoogleSignInClient = GoogleSignIn.getClient(context, googleSigninOptions)
//
//    override suspend fun isLoggedIn(): Boolean {
//        val googleSigninAccount = GoogleSignIn.getLastSignedInAccount(context)
//        Log.d(TAG, "id token ${googleSigninAccount?.idToken}")
//        if (googleSigninAccount != null){
//            val firebaseUser = firebaseLogin(googleSigninAccount.idToken!!)
//            return firebaseUser != null
//        }
//        return false
//    }
//
//    suspend fun firebaseLogin(idToken: String): FirebaseUser?{
//        return suspendCoroutine { con ->
//            val credential = GoogleAuthProvider.getCredential(idToken, null)
//            auth.signInWithCredential(credential)
//                .addOnCompleteListener {
//                    if (it.isSuccessful) {
//                        con.resume(it.result.user)
//                    } else {
////                        println("Something error with the authentication -- ${it.result}")
//                        signOut()
//                        con.resume(null)
//                    }
//                }
//        }
//    }
//
//    override fun signOut(){
//        auth.signOut()
//        GoogleSignIn.getClient(context.applicationContext, GoogleSignInOptions.DEFAULT_SIGN_IN).signOut()
//    }
//}