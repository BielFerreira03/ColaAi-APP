import { useState } from 'react';
import { Link } from 'react-router-dom'; // 1. Adicione a importação do Link
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import app from '../firebaseConfig';
import Card from '../components/Card';
import './Login.css';

const auth = getAuth(app);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Email ou senha inválidos.");
    }
  };

  return (
    <Card title="Cola Ai - Dashboard">
      <form onSubmit={handleLogin} className="login-form">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" required />
        {error && <p className="error-message">{error}</p>}
        <button type="submit">Entrar</button>
      </form>
      
      <div className="signup-link">
        <span>Não tem uma conta? <Link to="/cadastro" className='color-link'>Cadastre-se</Link></span>
      </div>
    </Card>
  );
}

