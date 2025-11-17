// src/components/SelectableStudentItem.jsx
import './SelectableStudentItem.css';

export default function SelectableStudentItem({ student, isSelected, onToggle }) {
  return (
    <div className={`selectable-item ${isSelected ? 'selected' : ''}`} onClick={onToggle}>
      <input 
        type="checkbox" 
        checked={isSelected} 
        readOnly // O clique é na div inteira para uma melhor experiência
      />
      <div className="student-info">
        <strong>{student.nomeAluno}</strong>
        <span>{student.endereco}</span>
      </div>
    </div>
  );
}