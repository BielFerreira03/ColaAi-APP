import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import app from '../firebaseConfig';

const auth = getAuth(app); // Coleta a instancia do auth firestone
const db = getFirestore(app); // Coleta a instância do banco

export function useAuth() {
  const [user, setUser] = useState(null); // coletar o usuário
  const [role, setRole] = useState(null); // coletar a função (papel)
  const [loading, setLoading] = useState(true); // está carregando ou não

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid); // conecta no banco
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          setRole(userDoc.data().papel);
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, role, loading };
}