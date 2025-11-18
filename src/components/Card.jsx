// src/components/Card.jsx
import './Card.css';

export default function Card({ title, children }) {
  return (
    <div className="card-container">
      {title && <h2 className="card-title">{title}</h2>}
      {children}
    </div>
  );
}