import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import app from '../firebaseConfig';
import './Cadastro.css';

const auth = getAuth(app);
const db = getFirestore(app);

export default function Cadastro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [papel, setPapel] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // --- Validação de Senha Segura ---
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(senha)) {
      setError('A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial (@$!%*?&).');
      return;
    }

    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!papel) {
      setError('Você deve selecionar a modalidade!')
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      await updateProfile(user, { displayName: nome });

      let codigoVinculo = null;
      if (papel === 'motorista') {
        const nomeParte = nome.split(' ')[0].toUpperCase().substring(0, 5);
        const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
        codigoVinculo = `${nomeParte}-${numeroAleatorio}`;
      }

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        displayName: nome,
        email: user.email,
        papel: papel,
        codigoVinculo: codigoVinculo,
      });


      if (papel === 'pai') {
        navigate('/painel-pai', { state: { message: 'Cadastro efetuado com sucesso! Por favor, faça o login.' } });
      }

      if (papel === 'motorista') {
        navigate('/dashboard', { state: { message: 'Cadastro efetuado com sucesso! Por favor, faça o login.' } });

      }
      // navigate('/login', { state: { message: 'Cadastro efetuado com sucesso! Por favor, faça o login.' } });

    } catch (err) {
      console.error("Erro ao criar conta:", err.code);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado.');
      } else {
        setError('Ocorreu um erro ao criar a conta. Tente novamente.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="cadastro-page-wrapper">
      <div className="cadastro-form-container">
        <h2>Crie sua Conta</h2>
        <p>Comece a organizar suas rotas ou a acompanhar seus filhos.</p>

        <form onSubmit={handleSubmit}>
          <div className="role-selector">
            <button type="button" className={papel === 'pai' ? 'active' : ''} onClick={() => setPapel('pai')}>Sou Responsável</button>
            <button type="button" className={papel === 'motorista' ? 'active' : ''} onClick={() => setPapel('motorista')}>Sou Motorista</button>
          </div>

          <div className="form-group">
            <label htmlFor="nome">Nome Completo</label>
            <input type="text" id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="senha">Senha</label>
            <input type="password" id="senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <p className="password-hint">Mín. 8 caracteres, 1 maiúscula, 1 número, 1 símbolo.</p>
          </div>
          <div className="form-group">
            <label htmlFor="confirmarSenha">Confirmar Senha</label>
            <input type="password" id="confirmarSenha" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Criando conta...' : 'Cadastrar'}
          </button>
        </form>

        <div className="login-link">
          <span>Já tem uma conta? <Link to="/login">Faça login</Link></span>
        </div>
      </div>
    </div>
  );
}

