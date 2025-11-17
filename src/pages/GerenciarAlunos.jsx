import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, GeoPoint } from "firebase/firestore";
import { FaSearch, FaMapMarkerAlt, FaPlus, FaUserGraduate, FaTimes, FaEdit, FaTrash, FaCheckCircle } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import app from '../firebaseConfig';
import DialogModal from '../components/DialogModal';
import './GerenciarAlunos.css';

const db = getFirestore(app);

// --- COMPONENTE DO MODAL (AGORA SERVE PARA ADICIONAR E EDITAR) ---
function AdicionarAlunoModal({ onClose, alunoParaEditar }) {
  const { user } = useAuth();

  // --- Estados para todos os campos ---
  const [nomeAluno, setNomeAluno] = useState('');
  const [endereco, setEndereco] = useState('');
  const [escola, setEscola] = useState('');
  const [serie, setSerie] = useState('');
  const [turno, setTurno] = useState('');
  const [contatoEmergencia, setContatoEmergencia] = useState('');
  const [obsMedicas, setObsMedicas] = useState('');
  const [necessidadesEspeciais, setNecessidadesEspeciais] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [emailResponsavel, setEmailResponsavel] = useState('');

  // --- Estados para a lógica de vínculo do pai ---
  const [responsavelEncontrado, setResponsavelEncontrado] = useState(null);
  const [verificandoEmail, setVerificandoEmail] = useState(false);

  // --- Estados para a geolocalização ---
  const [localizacao, setLocalizacao] = useState(null);
  const [geocodingStatus, setGeocodingStatus] = useState(''); // 'loading', 'success', 'error'
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
      setNomeResponsavel(alunoParaEditar.responsavelInfo?.nome || '');
      setEmailResponsavel(alunoParaEditar.responsavelInfo?.email || '');
      if (alunoParaEditar.responsavelUid) {
        setResponsavelEncontrado({ id: alunoParaEditar.responsavelUid, displayName: 'Vínculo existente' });
      }
      if (alunoParaEditar.localizacao) {
        setLocalizacao(alunoParaEditar.localizacao);
        setGeocodingStatus('success');
      }
      setAddressModified(false);
    }
  }, [alunoParaEditar]);

  // Função que atualiza o endereço e invalida as coordenadas
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

  const handleVerificarEmail = async () => {
    if (!emailResponsavel) return;
    setVerificandoEmail(true);
    setResponsavelEncontrado(null);
    setError('');

    try {
      const q = query(collection(db, 'users'), where("papel", "==", "pai"), where("email", "==", emailResponsavel.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Nenhum responsável com este e-mail possui cadastro. O aluno será salvo sem vínculo.');
      } else {
        const responsavelDoc = querySnapshot.docs[0];
        setResponsavelEncontrado({ id: responsavelDoc.id, ...responsavelDoc.data() });
      }
    } catch (err) {
      console.error("Erro ao verificar email:", err);
      setError('Ocorreu um erro ao buscar o responsável.');
    } finally {
      setVerificandoEmail(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Você precisa estar logado para cadastrar um aluno.');
      return;
    }
    if (!nomeAluno || !endereco || !escola || !turno) {
      setError('Por favor, preencha todos os campos obrigatórios do aluno (*).');
      return;
    }
    if (!localizacao) {
      setError('É necessário obter as coordenadas do endereço. Clique no ícone do mapa ao lado do campo de endereço.');
      return;
    }
    setLoading(true);
    setError('');

    const dadosParaSalvar = {
      nomeAluno, endereco, escola, serie, turno, localizacao,
      saude: { contatoEmergencia, obsMedicas, necessidadesEspeciais },
      responsavelInfo: { nome: nomeResponsavel, email: emailResponsavel },
      criadoPorId: alunoParaEditar ? alunoParaEditar.criadoPorId : user.uid,
      responsavelUid: responsavelEncontrado ? responsavelEncontrado.id : (alunoParaEditar ? alunoParaEditar.responsavelUid : null),
      motoristaId: user.uid,
    };

    try {
      if (alunoParaEditar) {
        const alunoDocRef = doc(db, 'alunos', alunoParaEditar.id);
        await updateDoc(alunoDocRef, dadosParaSalvar);
      } else {
        await addDoc(collection(db, 'alunos'), dadosParaSalvar);
      }
      onClose();
    } catch (err) {
      console.error("Erro ao salvar aluno:", err);
      setError('Ocorreu um erro ao salvar os dados. Tente novamente.');
      setLoading(false);
    }
  };

  const isEditing = !!alunoParaEditar;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}</h2>
          <button onClick={onClose} className="close-button"><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="aluno-form">
          <div className="form-section">
            <h3>Dados do Aluno</h3>
            <div className="form-group">
              <label htmlFor="nomeAluno">Nome Completo *</label>
              <input type="text" id="nomeAluno" value={nomeAluno} onChange={(e) => setNomeAluno(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="endereco">Endereço Completo *</label>
              <div className="codigo-input-wrapper">
                <input
                    type="text"
                    id="endereco"
                    value={endereco}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    placeholder="Rua, Número, Bairro, Cidade"
                    required
                />
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
          </div>

          <div className="form-section">
            <h3>Dados do Responsável (Opcional)</h3>
            <div className="form-group">
              <label htmlFor="nomeResponsavel">Nome do Responsável</label>
              <input type="text" id="nomeResponsavel" value={nomeResponsavel} onChange={(e) => setNomeResponsavel(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="emailResponsavel">Email do Responsável (para vínculo)</label>
              <div className="codigo-input-wrapper">
                <input
                  type="email"
                  id="emailResponsavel"
                  value={emailResponsavel}
                  onChange={(e) => setEmailResponsavel(e.target.value)}
                  disabled={isEditing && alunoParaEditar.responsavelUid}
                />
                <button type="button" onClick={handleVerificarEmail} disabled={verificandoEmail || !emailResponsavel || (isEditing && alunoParaEditar.responsavelUid)}>
                  {verificandoEmail ? '...' : 'Verificar'}
                </button>
              </div>
              {responsavelEncontrado && (
                <p className="success-message">
                  <FaCheckCircle />
                  {isEditing ? 'Responsável já vinculado.' : `Responsável encontrado: ${responsavelEncontrado.displayName || responsavelEncontrado.email}`}
                </p>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3>Informações Adicionais</h3>
            <div className="form-group">
              <label htmlFor="contatoEmergencia">Contato de Emergência</label>
              <input type="tel" id="contatoEmergencia" value={contatoEmergencia} onChange={(e) => setContatoEmergencia(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="form-group">
              <label htmlFor="obsMedicas">Observações Médicas</label>
              <textarea id="obsMedicas" value={obsMedicas} onChange={(e) => setObsMedicas(e.target.value)} placeholder="Alergias, medicamentos, etc."></textarea>
            </div>
            <div className="form-group">
              <label htmlFor="necessidadesEspeciais">Necessidades Especiais</label>
              <textarea id="necessidadesEspeciais" value={necessidadesEspeciais} onChange={(e) => setNecessidadesEspeciais(e.target.value)} placeholder="Cadeirante, deficiência visual, etc."></textarea>
            </div>
          </div>

          {error && <p className="error-message">{error}</p>}
          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Cadastrar Aluno')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL DA PÁGINA ---
export default function GerenciarAlunos() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alunoParaEditar, setAlunoParaEditar] = useState(null);
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false });

  useEffect(() => {
    if (!user) return;

    const alunosRef = collection(db, 'alunos');
    const q = query(alunosRef, where("motoristaId", "==", user.uid));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const studentList = [];
      querySnapshot.forEach((doc) => {
        studentList.push({ id: doc.id, ...doc.data() });
      });
      setStudents(studentList);
      setLoading(false);
    }, (error) => {
        console.error("Erro ao buscar alunos:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleOpenModalForNew = () => {
    setAlunoParaEditar(null);
    setIsModalOpen(true);
  };

  const handleOpenModalForEdit = (student) => {
    setAlunoParaEditar(student);
    setIsModalOpen(true);
  };

  const handleDelete = (studentId) => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir este aluno? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'alunos', studentId));
          setDialogConfig({ isOpen: true, type: 'success', title: 'Sucesso!', message: 'Aluno excluído.' });
        } catch (error) {
          console.error("Erro ao excluir aluno: ", error);
          setDialogConfig({ isOpen: true, type: 'warning', title: 'Erro', message: 'Não foi possível excluir o aluno.' });
        }
      }
    });
  };

  return (
    <div className="gerenciar-alunos-page">
      <DialogModal config={dialogConfig} setConfig={setDialogConfig} />
      <div className="page-header">
        <div>
          <h2>Meus Alunos</h2>
          <p>Gerencie os alunos cadastrados por você ou vinculados por pais.</p>
        </div>
        <button onClick={handleOpenModalForNew} className="add-button">
          <FaPlus /> Novo Aluno
        </button>
      </div>
      <div className="toolbar">
        <div className="search-bar">
          <FaSearch />
          <input type="text" placeholder="Buscar por nome, endereço ou escola..." />
        </div>
        <select>
          <option>Todos os turnos</option>
          <option>Manhã</option>
          <option>Tarde</option>
        </select>
      </div>
      <div className="student-list-container">
        {loading && <p>Carregando alunos...</p>}
        {!loading && students.length === 0 && (
          <div className="empty-state">
            <FaUserGraduate size={50} color="#cbd5e1" />
            <h3>Nenhum aluno encontrado</h3>
            <p>Clique em "+ Novo Aluno" para cadastrar um aluno e seu responsável.</p>
          </div>
        )}
        {students.map(student => (
          <div key={student.id} className="student-card">
            <div className="student-card-header">
              <span className="student-name">{student.nomeAluno}</span>
              <div className="card-actions">
                <button onClick={() => handleOpenModalForEdit(student)} className="icon-button edit-btn">
                  <FaEdit />
                </button>
                <button onClick={() => handleDelete(student.id)} className="icon-button delete-btn">
                  <FaTrash />
                </button>
              </div>
            </div>
            <div className="student-card-body">
              <p className="school-name">{student.escola || 'Escola não informada'}</p>
              <div className="tags">
                <span className="tag-turno">{student.turno || 'Turno não informado'}</span>
                {student.serie && <span className="tag-grade">{student.serie}</span>}
                {student.saude?.obsMedicas && <span className="tag-saude">{student.saude.obsMedicas}</span>}
              </div>
              <div className="tags">
                {student.saude?.necessidadesEspeciais && <span className="tag-importante">{student.saude.necessidadesEspeciais}</span>}
              </div>
              <p className="address"><FaMapMarkerAlt /> {student.endereco || 'Endereço não informado'}</p>
            </div>
            <div className="student-card-footer">
              <span className="responsavel-info">
                Responsável: {student.responsavelInfo?.nome || 'Não informado'}
              </span>
            </div>
          </div>
        ))}
      </div>
      {isModalOpen && <AdicionarAlunoModal onClose={() => setIsModalOpen(false)} alunoParaEditar={alunoParaEditar} />}
    </div>
  );
}

