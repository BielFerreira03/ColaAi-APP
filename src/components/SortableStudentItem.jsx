// src/components/SortableStudentItem.jsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaBars } from 'react-icons/fa';
import './SortableStudentItem.css';

export default function SortableStudentItem({ id, student }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="sortable-item">
      <FaBars className="drag-handle" />
      <div className="student-info">
        <strong>{student.nomeAluno}</strong>
        <span>{student.endereco}</span>
      </div>
    </div>
  );
}