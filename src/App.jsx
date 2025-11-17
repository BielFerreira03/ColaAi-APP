import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

import Layout from './components/Layout';
import MotoristaLayout from './components/MotoristaLayout';
import PaiLayout from './components/PaiLayout'

// Pages
import Login from './pages/Login';
import Cadastro from './pages/Cadastro'; // 1. Importa a página de Cadastro
import DashboardMotorista from './pages/DashboardMotorista';
import DashboardPai from './pages/DashboardPai';
import GerenciarAlunos from './pages/GerenciarAlunos';
import GerenciarRotas from './pages/GerenciarRotas';
import ExecutarRota from './pages/ExecutarRota';
import GerenciarFilhos from './pages/GerenciarFilhos'
import MeuPerfil from './pages/MeuPerfil'

function App() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <Layout><h1>Carregando...</h1></Layout>;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota de Login: se já estiver logado, redireciona */}
        <Route path="/login" element={
          !user ? (
            <Layout><Login /></Layout>

          ) : (
            <Navigate to={role === 'motorista' ? '/dashboard' : '/painel-pai'} />

          )
        } />

        {/* 2. Adiciona a Rota de Cadastro */}
        <Route path="/cadastro" element={
          !user ? (
            <Layout><Cadastro /></Layout>
          ) : (
            <Navigate to={role === 'motorista' ? '/dashboard' : '/painel-pai'} />
          )
        } />


        {/* Rotas Protegidas do Motorista */}
        {user && role === 'motorista' ? (
          <Route element={<MotoristaLayout />}>
            <Route path="/dashboard" element={<DashboardMotorista />} />
            <Route path="/alunos" element={<GerenciarAlunos />} />
            <Route path="/rotas" element={<GerenciarRotas />} />
            <Route path="/executar-rota" element={<ExecutarRota />} />
            <Route path="/meu-perfil" element={<MeuPerfil />} />

            {/* Redirecionamento padrão para o dashboard do motorista */}
            <Route index element={<Navigate to="/dashboard" />} />
          </Route>
        ) : null}

        {/* Rotas Protegidas do Pai */}
        {user && role === 'pai' ? (
          <Route element={<PaiLayout />}>
            <Route path="/painel-pai" element={<DashboardPai />} />
            <Route path="/filhos" element={<GerenciarFilhos />} />
            <Route path="/meu-perfil" element={<MeuPerfil />} />

          </Route>
        ) : null}



        {/* Se nenhuma rota corresponder, redireciona para o login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

