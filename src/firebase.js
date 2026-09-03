import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAusjop-aZ55DzzoMsD-ckpiXBq0glxDu8",
  authDomain: "optm-system.firebaseapp.com",
  projectId: "optm-system",
  storageBucket: "optm-system.firebasestorage.app",
  messagingSenderId: "180651537611",
  appId: "1:180651537611:web:2a33ce752b5484d723d74e"
};


const app = initializeApp(firebaseConfig);


export const db = getFirestore(app);
export const auth = getAuth(app);