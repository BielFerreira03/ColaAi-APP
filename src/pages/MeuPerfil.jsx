import { useState } from 'react';
import { getAuth, updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import app from '../firebaseConfig';
import Card from '../components/Card';
import DialogModal from '../components/DialogModal';
import './MeuPerfil.css';

const auth = getAuth(app);
const db = getFirestore(app);

export default function MeuPerfil() {
  const { user } = useAuth();
  
  // Estados para o formulário de nome
  const [nome, setNome] = useState(user?.displayName || '');
  const [loadingNome, setLoadingNome] = useState(false);

  // Estados para o formulário de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [loadingSenha, setLoadingSenha] = useState(false);

  // Estado para o modal de feedback
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false });

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!user || !nome) return;
    setLoadingNome(true);

    try {
      // 1. Atualiza no Firebase Authentication
      await updateProfile(auth.currentUser, { displayName: nome });
      
      // 2. Atualiza no Firestore para manter a consistência
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { displayName: nome });

      setDialogConfig({ isOpen: true, type: 'success', title: 'Sucesso!', message: 'Seu nome foi atualizado.' });
    } catch (error) {
      console.error("Erro ao atualizar nome:", error);
      setDialogConfig({ isOpen: true, type: 'warning', title: 'Erro', message: 'Não foi possível atualizar seu nome.' });
    } finally {
      setLoadingNome(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!user || !senhaAtual || !novaSenha) return;

    // --- Validação de Senha Segura ---
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(novaSenha)) {
        setDialogConfig({ isOpen: true, type: 'warning', title: 'Senha Fraca', message: 'A nova senha deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial (@$!%*?&).' });
        return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      setDialogConfig({ isOpen: true, type: 'warning', title: 'Atenção', message: 'As novas senhas não coincidem.' });
      return;
    }
    setLoadingSenha(true);

    try {
      // Firebase exige que o usuário se reautentique para trocar a senha (segurança)
      const credential = EmailAuthProvider.credential(user.email, senhaAtual);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Se a reautenticação deu certo, atualiza a senha
      await updatePassword(auth.currentUser, novaSenha);

      setDialogConfig({ isOpen: true, type: 'success', title: 'Sucesso!', message: 'Sua senha foi alterada. Você pode precisar fazer login novamente.' });
      // Limpa os campos após o sucesso
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');

    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      let message = 'Não foi possível alterar sua senha. Tente novamente.';
      if (error.code === 'auth/wrong-password') {
        message = 'A senha atual está incorreta.';
      }
      setDialogConfig({ isOpen: true, type: 'warning', title: 'Erro', message });
    } finally {
      setLoadingSenha(false);
    }
  };

    const DisplayName = user?.displayName || ' '

  return (
    <div className="meu-perfil-page">
      <DialogModal config={dialogConfig} setConfig={setDialogConfig} />

      <div className="page-header">
        <h2>Meu Perfil</h2>
        <p>Gerencie suas informações pessoais e de segurança.</p>
      </div>

      <div className="perfil-cards-container">
        {/* Card para Alterar o Nome */}
        <Card>
          <form onSubmit={handleUpdateName} className="perfil-form">
            <h3>Alterar Nome</h3>
            <div className="form-group">
              <label htmlFor="nome">Nome de Exibição</label>
              <input type="text" id="nome" placeholder={`Ex: ${DisplayName}`} value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <button type="submit" className="submit-button" disabled={loadingNome}>
              {loadingNome ? 'Salvando...' : 'Salvar Nome'}
            </button>
          </form>
        </Card>

        {/* Card para Alterar a Senha */}
        <Card>
          <form onSubmit={handleUpdatePassword} className="perfil-form">
            <h3>Alterar Senha</h3>
            <div className="form-group">
              <label htmlFor="senhaAtual">Senha Atual</label>
              <input type="password" id="senhaAtual" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="novaSenha">Nova Senha</label>
              <input type="password" id="novaSenha" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required />
               <p className="password-hint">Mín. 8 caracteres, 1 maiúscula, 1 número, 1 símbolo.</p>
            </div>
            <div className="form-group">
              <label htmlFor="confirmarNovaSenha">Confirmar Nova Senha</label>
              <input type="password" id="confirmarNovaSenha" value={confirmarNovaSenha} onChange={(e) => setConfirmarNovaSenha(e.target.value)} required />
            </div>
            <button type="submit" className="submit-button" disabled={loadingSenha}>
              {loadingSenha ? 'Salvando...' : 'Alterar Senha'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

