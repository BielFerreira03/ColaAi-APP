// src/components/Card.jsx
import './CardPai.css';

export default function CardPai({ title, children }) {
  return (
    <div className="card-container2">
      {title && <h2 className="card-title">{title}</h2>}
      {children}
    </div>
  );
}