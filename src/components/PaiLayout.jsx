// src/components/MotoristaLayout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { FaTachometerAlt, FaUsers, FaRoad, FaRoute, FaSignOutAlt, FaRegUser } from 'react-icons/fa';
import './PaiLayout.css';
import { useAuth } from '../hooks/useAuth'; 

import BottomBarPai from './BottomBarPai';

const auth = getAuth();

export default function PaiLayout() {
  const { email } = auth.currentUser || {};
  const navigate = useNavigate();
  const { user } = useAuth();
  
  

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const displayName = user?.displayName || 'Responsável'

  return (
    <div className="motorista-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Cola Ai</h2>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/painel-pai"><FaTachometerAlt /> Dashboard</NavLink>
          <NavLink to="/filhos"><FaUsers /> Filhos Cadastrados</NavLink>
          <NavLink to="/meu-perfil"><FaRegUser /> Meu Perfil</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <strong>{displayName}</strong>
            <span>{email}</span>
          </div>
          <button className="logout-button" onClick={handleLogout}><FaSignOutAlt /> Sair</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet /> 
      </main>

      <BottomBarPai />
    </div>
  );
}