import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, GeoPoint } from "firebase/firestore";
import { FaPlus, FaUserGraduate, FaTimes, FaCheckCircle, FaEdit, FaTrash, FaMapMarkerAlt } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import app from '../firebaseConfig';
import DialogModal from '../components/DialogModal';
import './GerenciarAlunos.css'; // Reaproveitando o mesmo CSS!

const db = getFirestore(app);

// --- COMPONENTE DO MODAL (AGORA SERVE PARA ADICIONAR E EDITAR) ---
function AdicionarFilhoModal({ onClose, alunoParaEditar }) {
  const { user } = useAuth();

  // Estados do formulário
  const [nomeAluno, setNomeAluno] = useState('');
  const [endereco, setEndereco] = useState('');
  const [escola, setEscola] = useState('');
  const [serie, setSerie] = useState('');
  const [turno, setTurno] = useState('');
  const [contatoEmergencia, setContatoEmergencia] = useState('');
  const [obsMedicas, setObsMedicas] = useState('');
  const [necessidadesEspeciais, setNecessidadesEspeciais] = useState('');

  // Estados para a lógica de vínculo por código
  const [codigoMotorista, setCodigoMotorista] = useState('');
  const [motoristaEncontrado, setMotoristaEncontrado] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [selectedMotoristaId, setSelectedMotoristaId] = useState('');

  // --- Estados para a geolocalização ---
  const [localizacao, setLocalizacao] = useState(null);
  const [geocodingStatus, setGeocodingStatus] = useState('');
  const [addressModified, setAddressModified] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Efeito para preencher o formulário quando for uma edição
  useEffect(() => {
    if (alunoParaEditar) {
      setNomeAluno(alunoParaEditar.nomeAluno || '');
      setEndereco(alunoParaEditar.endereco || '');
      setEscola(alunoParaEditar.escola || '');
      setSerie(alunoParaEditar.serie || '');
      setTurno(alunoParaEditar.turno || '');
      setContatoEmergencia(alunoParaEditar.saude?.contatoEmergencia || '');
      setObsMedicas(alunoParaEditar.saude?.obsMedicas || '');
      setNecessidadesEspeciais(alunoParaEditar.saude?.necessidadesEspeciais || '');
      setSelectedMotoristaId(alunoParaEditar.motoristaId || '');
      setMotoristaEncontrado({ id: alunoParaEditar.motoristaId, displayName: 'Vínculo existente' });
      if (alunoParaEditar.localizacao) {
        setLocalizacao(alunoParaEditar.localizacao);
        setGeocodingStatus('success');
      }
      setAddressModified(false);
    }
  }, [alunoParaEditar]);

  const handleAddressChange = (value) => {
    setEndereco(value);
    setLocalizacao(null);
    setGeocodingStatus('');
    setError('');
    setAddressModified(true);
  };

  const handleGeocodeAddress = async () => {
    if (!endereco) {
      setGeocodingStatus('error');
      setError('Por favor, preencha o campo de endereço primeiro.');
      return;
    }
    setGeocodingStatus('loading');
    setError('');
    setAddressModified(false);
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}`, {
        headers: { 'User-Agent': `AppColaAi/1.0 (${user.email})` },
        referrerPolicy: "no-referrer"
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setLocalizacao(new GeoPoint(parseFloat(lat), parseFloat(lon)));
        setGeocodingStatus('success');
      } else {
        setLocalizacao(null);
        setGeocodingStatus('error');
        setError('Não foi possível encontrar as coordenadas para este endereço.');
      }
    } catch (err) {
      console.error("Erro de geocodificação:", err);
      setLocalizacao(null);
      setGeocodingStatus('error');
      setError('Ocorreu um erro ao buscar as coordenadas. Tente novamente.');
    }
  };

  const handleVerificarCodigo = async () => {
    if (!codigoMotorista) return;
    setVerificando(true);
    setMotoristaEncontrado(null);
    setSelectedMotoristaId('');
    setError('');
    try {
      const q = query(collection(db, 'users'), where("papel", "==", "motorista"), where("codigoVinculo", "==", codigoMotorista.trim()));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setError('Nenhum motorista encontrado com este código.');
      } else {
        const motoristaDoc = querySnapshot.docs[0];
        setMotoristaEncontrado({ id: motoristaDoc.id, ...motoristaDoc.data() });
        setSelectedMotoristaId(motoristaDoc.id);
      }
    } catch (err) {
      setError('Ocorreu um erro ao buscar o motorista.');
    } finally {
      setVerificando(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nomeAluno || !escola || !turno || !selectedMotoristaId) {
      setError('Por favor, preencha os campos obrigatórios e vincule um motorista válido.');
      return;
    }
    if (!localizacao) {
      setError('É necessário obter as coordenadas do endereço.');
      return;
    }
    setLoading(true);
    setError('');

    const dadosParaSalvar = {
      nomeAluno, endereco, escola, serie, turno, localizacao,
      saude: { contatoEmergencia, obsMedicas, necessidadesEspeciais },
      responsavelInfo: { nome: user.displayName || user.email, email: user.email },
      responsavelUid: user.uid,
      criadoPorId: alunoParaEditar ? alunoParaEditar.criadoPorId : user.uid,
      motoristaId: selectedMotoristaId,
    };

    try {
      if (alunoParaEditar) {
        await updateDoc(doc(db, 'alunos', alunoParaEditar.id), dadosParaSalvar);
      } else {
        await addDoc(collection(db, 'alunos'), dadosParaSalvar);
      }
      onClose();
    } catch (err) {
      setError('Ocorreu um erro ao salvar. Tente novamente.');
      setLoading(false);
    }
  };

  const isEditing = !!alunoParaEditar;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Editar Dados do Filho(a)' : 'Cadastrar Filho(a)'}</h2>
          <button onClick={onClose} className="close-button"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="aluno-form">
          <div className="form-group">
            <label htmlFor="codigoMotorista">Código de Vínculo do Motorista *</label>
            <div className="codigo-input-wrapper">
              <input type="text" id="codigoMotorista" value={codigoMotorista} onChange={(e) => setCodigoMotorista(e.target.value)} placeholder="Ex: CARLOS-123" disabled={isEditing} />
              <button type="button" onClick={handleVerificarCodigo} disabled={verificando || !codigoMotorista || isEditing}>
                {verificando ? '...' : 'Verificar'}
              </button>
            </div>
            {motoristaEncontrado && (
              <p className="success-message">
                <FaCheckCircle /> Motorista: <strong>{isEditing ? 'Vínculo existente' : (motoristaEncontrado.displayName || motoristaEncontrado.email)}</strong>
              </p>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="nomeAluno">Nome Completo *</label>
            <input type="text" id="nomeAluno" value={nomeAluno} onChange={(e) => setNomeAluno(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="endereco">Endereço Completo *</label>
            <div className="codigo-input-wrapper">
              <input type="text" id="endereco" value={endereco} onChange={(e) => handleAddressChange(e.target.value)} placeholder="Rua, Número, Bairro, Cidade" required />
              <button type="button" onClick={handleGeocodeAddress} disabled={geocodingStatus === 'loading'}>
                {geocodingStatus === 'loading' ? '...' : <FaMapMarkerAlt />}
              </button>
            </div>
            {addressModified && <p className="warning-message">Endereço alterado. Verifique as coordenadas novamente.</p>}
            {geocodingStatus === 'success' && !addressModified && <p className="success-message">Coordenadas obtidas com sucesso!</p>}
            {geocodingStatus === 'error' && <p className="error-message">{error || 'Falha ao obter coordenadas.'}</p>}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="escola">Escola *</label>
              <input type="text" id="escola" value={escola} onChange={(e) => setEscola(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="serie">Série/Ano</label>
              <input type="text" id="serie" value={serie} onChange={(e) => setSerie(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="turno">Turno *</label>
            <select id="turno" value={turno} onChange={(e) => setTurno(e.target.value)} required>
              <option value="" disabled>Selecione o turno</option>
              <option value="Manhã">Manhã</option>
              <option value="Tarde">Tarde</option>
              <option value="Integral">Integral</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="contatoEmergencia">Contato de Emergência</label>
            <input type="tel" id="contatoEmergencia" value={contatoEmergencia} onChange={(e) => setContatoEmergencia(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="obsMedicas">Observações Médicas</label>
            <textarea id="obsMedicas" value={obsMedicas} onChange={(e) => setObsMedicas(e.target.value)} rows="3"></textarea>
          </div>
          <div className="form-group">
            <label htmlFor="necessidadesEspeciais">Necessidades Especiais</label>
            <textarea id="necessidadesEspeciais" value={necessidadesEspeciais} onChange={(e) => setNecessidadesEspeciais(e.target.value)} rows="3"></textarea>
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Cadastrar Filho(a)')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// --- COMPONENTE PRINCIPAL DA PÁGINA ---
export default function GerenciarFilhos() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alunoParaEditar, setAlunoParaEditar] = useState(null);
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'alunos'), where("responsavelUid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const childrenList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChildren(childrenList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleOpenModalForNew = () => {
    setAlunoParaEditar(null);
    setIsModalOpen(true);
  };

  const handleOpenModalForEdit = (child) => {
    setAlunoParaEditar(child);
    setIsModalOpen(true);
  };

  const handleDelete = (childId) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir este cadastro? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'alunos', childId));
          setDialogConfig({ isOpen: true, type: 'success', title: 'Sucesso!', message: 'Cadastro excluído.' });
        } catch (error) {
          console.error("Erro ao excluir aluno: ", error);
          setDialogConfig({ isOpen: true, type: 'warning', title: 'Erro', message: 'Não foi possível excluir o cadastro.' });
        }
      }
    });
  };

  return (
    <div className="gerenciar-alunos-page">
      <DialogModal config={dialogConfig} setConfig={setDialogConfig} />

      <div className="page-header">
        <div>
          <h2>Meus Filhos</h2>
          <p>Gerencie as informações dos seus filhos cadastrados.</p>
        </div>
        <button onClick={handleOpenModalForNew} className="add-button">
          <FaPlus /> Adicionar Filho(a)
        </button>
      </div>

      <div className="student-list-container">
        {loading && <p>Carregando...</p>}
        {!loading && children.length === 0 && (
          <div className="empty-state">
            <FaUserGraduate size={50} color="#cbd5e1" />
            <h3>Nenhum filho cadastrado</h3>
            <p>Clique em "+ Adicionar Filho(a)" para começar.</p>
          </div>
        )}
        {children.map(child => (
          <div key={child.id} className="student-card">
            <div className="student-card-header">
              <span className="student-name">{child.nomeAluno}</span>
              <div className="card-actions">
                <button onClick={() => handleOpenModalForEdit(child)} className="icon-button edit-btn">
                  <FaEdit />
                </button>
                <button onClick={() => handleDelete(child.id)} className="icon-button delete-btn">
                  <FaTrash />
                </button>
              </div>
            </div>
            <div className="student-card-body">
              <p><strong>Escola:</strong> {child.escola || 'Não informado'}</p>
              <div className="tags">
                <span className="tag-turno">{child.turno || 'Turno não informado'}</span>
                {child.serie && <span className="tag-grade">{child.serie}</span>}
                {child.saude?.obsMedicas &&
                    <span className="tag-saude">{child.saude.obsMedicas}</span>
                }
              </div>
              <div className="tags">
                  {child.saude?.necessidadesEspeciais && <span className="tag-importante">{child.saude.necessidadesEspeciais}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && <AdicionarFilhoModal onClose={() => setIsModalOpen(false)} alunoParaEditar={alunoParaEditar} />}
    </div>
  );
}