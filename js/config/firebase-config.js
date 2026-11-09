// ไฟล์: js/config/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// นำค่า firebaseConfig จาก Firebase Console ของคุณมาวางทับตรงนี้
const firebaseConfig = {
    apiKey: "AIzaSyA_M_v66SbHiLLcZ7E3RZBNcc7HxzNnt5Q",
    authDomain: "rmutt-education-queue.firebaseapp.com",
    projectId: "rmutt-education-queue",
    storageBucket: "rmutt-education-queue.firebasestorage.app",
    messagingSenderId: "496671540222",
    appId: "1:496671540222:web:b6ee8ef7b1c9037ee736af"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);