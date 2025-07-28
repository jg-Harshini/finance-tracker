import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBR84hSc1XTb6X0-xhjSm11B-SGLPGhBXM",
  authDomain: "finance-tracker-eeb19.firebaseapp.com",
  projectId: "finance-tracker-eeb19",
  storageBucket: "finance-tracker-eeb19.firebasestorage.app",
  messagingSenderId: "266250131959",
  appId: "1:266250131959:web:0d6f78782fd9dd5171b6f2"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
