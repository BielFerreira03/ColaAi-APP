import { FaTimes, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import './DialogModal.css';

export default function DialogModal({ config, setConfig }) {
  if (!config.isOpen) {
    return null;
  }

  const handleClose = () => {
    setConfig({ isOpen: false });
  };

  const handleConfirm = () => {
    if (config.onConfirm) {
      config.onConfirm();
    }
    handleClose();
  };

  const isConfirmation = !!config.onConfirm;
  const icon = config.type === 'success' ? <FaCheckCircle className="icon-success" /> : <FaExclamationTriangle className="icon-warning" />;

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <div className="dialog-header">
          {icon}
          <h3>{config.title}</h3>
        </div>
        <p className="dialog-message">{config.message}</p>
        <div className="dialog-footer">
          {isConfirmation && (
            <button className="cancel-btn" onClick={handleClose}>
              Cancelar
            </button>
          )}
          <button className="confirm-btn" onClick={handleConfirm}>
            {isConfirmation ? 'Confirmar' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}