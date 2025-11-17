import { useState } from 'react'; // 1. Importe o useState
import { NavLink, useNavigate } from 'react-router-dom'; // 2. Importe o useNavigate
import { getAuth, signOut } from 'firebase/auth'; // 3. Importe as funções de autenticação
import { FaTachometerAlt, FaUsers, FaRoad, FaRoute, FaEllipsisH, FaSignOutAlt, FaRegUser } from 'react-icons/fa'; // 4. Importe novos ícones
import './BottomBarPai.css';

const auth = getAuth(); // Inicialize o auth

export default function BottomBarPai() {
  const [dropdownVisible, setDropdownVisible] = useState(false); // 5. Estado para controlar o dropdown
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  return (
    // Adicionamos uma div wrapper para ajudar no posicionamento do dropdown
    <div className="bottom-bar-wrapper">
      <nav className="barra-inferior-mobile">
        <NavLink to="/Painel-pai">
          <FaTachometerAlt />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/filhos">
          <FaUsers />
          <span>Filhos</span>
        </NavLink>
        <NavLink to="/meu-perfil">
          <FaRegUser  />
          <span>Meu Perfil</span>
        </NavLink>
        
        {/* 6. Novo botão "Mais" que abre o dropdown */}
        <button type="button" className="dropdown-toggle" onClick={toggleDropdown}>
          <FaEllipsisH />
          <span>Mais</span>
        </button>
      </nav>

      {/* 7. O menu dropdown em si */}
      {dropdownVisible && (
        <div className="dropdown-menu">
          <button type="button" className="dropdown-item" onClick={handleLogout}>
            <FaSignOutAlt />
            <span>Sair</span>
          </button>
        </div>
      )}
    </div>
  );
}