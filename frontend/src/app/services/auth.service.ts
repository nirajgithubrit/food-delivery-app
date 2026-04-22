import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDy5WW0yTQAdcfhmlmNkJoGxXFP1z2UpCo",
    authDomain: "localbite-b348d.firebaseapp.com",
    projectId: "localbite-b348d",
    storageBucket: "localbite-b348d.firebasestorage.app",
    messagingSenderId: "459210071663",
    appId: "1:459210071663:web:24983c567c04cc8e51779a"
};


@Injectable({ providedIn: 'root' })
export class AuthService {

    app = initializeApp(firebaseConfig);
    auth = getAuth(this.app);

    setupRecaptcha(containerId: string) {
        return new RecaptchaVerifier(
            this.auth,            // ✅ FIRST param must be auth
            containerId,          // ✅ SECOND param is container
            {
                size: 'normal'
            }
        );
    }

    sendOTP(phone: string, appVerifier: any) {
        return signInWithPhoneNumber(this.auth, phone, appVerifier);
    }
}