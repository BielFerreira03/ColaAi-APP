// src/components/Layout.jsx
import './Layout.css'; // Vamos criar este CSS a seguir

// Este componente recebe outras páginas como "children" e as renderiza dentro de um layout padrão
export default function Layout({ children }) {
  return (
    <main className="layout-container">
      {children}
    </main>
  );
}