import { useState, useEffect } from 'react';

import { getAuth } from "firebase/auth";

import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, where, GeoPoint, getDocs } from "firebase/firestore";

import { FaPlus, FaUsers, FaClock, FaMapMarkerAlt, FaFlagCheckered, FaEdit, FaTrashAlt } from 'react-icons/fa';

import app from '../firebaseConfig';

import Modal from '../components/Modal';

import DialogModal from '../components/DialogModal';

import { useAuth } from '../hooks/useAuth';

import './GerenciarRotas.css';



const auth = getAuth(app);

const db = getFirestore(app);



// Estado inicial agora inclui campos para as coordenadas

const initialFormState = {

  nome: '',

  turno: 'Manhã',

  tipo: 'Coleta (Casa -> Escola)',

  duracaoEstimada: '',

  inicio: '', // Texto do endereço de início

  destino: '', // Texto do endereço de destino

  localizacaoInicio: null, // GeoPoint do início

  localizacaoDestino: null, // GeoPoint do destino

  alunos_ordem: []

};



export default function GerenciarRotas() {

  const { user } = useAuth();

  const [routes, setRoutes] = useState([]);

  const [allStudents, setAllStudents] = useState([]);

  const [loading, setLoading] = useState(true);

 

  const [showFormModal, setShowFormModal] = useState(false);

  const [editingRoute, setEditingRoute] = useState(null);

  const [formData, setFormData] = useState(initialFormState);



  const [dialogConfig, setDialogConfig] = useState({ isOpen: false });



  // --- Estados para a geolocalização ---

  const [geocodingStatus, setGeocodingStatus] = useState({ inicio: '', destino: '' });

  const [geoLoading, setGeoLoading] = useState({ inicio: false, destino: false });

  const [geoError, setGeoError] = useState('');



  useEffect(() => {

    if (!user) return;

    const routesCollectionRef = collection(db, 'users', user.uid, 'rotas');

    const unsubscribeRoutes = onSnapshot(routesCollectionRef, (snapshot) => {

      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      setLoading(false);

    });

    return () => unsubscribeRoutes();

  }, [user]);



  useEffect(() => {

    if (!user) return;

    const alunosRef = collection(db, 'alunos');

    const q = query(alunosRef, where("motoristaId", "==", user.uid));

    const unsubscribeStudents = onSnapshot(q, (querySnapshot) => {

      const studentList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setAllStudents(studentList);

    });

    return () => unsubscribeStudents();

  }, [user]);



  const handleInputChange = (e) => {

    const { name, value } = e.target;

    setFormData({ ...formData, [name]: value });

    // Se o endereço de início ou destino for alterado, invalida as coordenadas

    if (name === 'inicio') {

      setGeocodingStatus(prev => ({ ...prev, inicio: '' }));

      setFormData(prev => ({ ...prev, localizacaoInicio: null }));

    }

    if (name === 'destino') {

      setGeocodingStatus(prev => ({ ...prev, destino: '' }));

      setFormData(prev => ({ ...prev, localizacaoDestino: null }));

    }

  };



  const handleOpenFormModal = (route = null) => {

    if (route) {

      setEditingRoute(route);

      setFormData({ ...initialFormState, ...route });

      // Define o status de geocodificação se já existirem coordenadas

      setGeocodingStatus({

        inicio: route.localizacaoInicio ? 'success' : '',

        destino: route.localizacaoDestino ? 'success' : ''

      });

    } else {

      setEditingRoute(null);

      setFormData(initialFormState);

      setGeocodingStatus({ inicio: '', destino: '' });

    }

    setGeoError('');

    setShowFormModal(true);

  };



  // --- Nova Função ---

  // Função reutilizável para buscar coordenadas (para início ou destino)

  const handleGeocodeAddress = async (fieldType) => {

    const address = formData[fieldType]; // 'inicio' ou 'destino'

    if (!address) {

      setGeoError(`Preencha o campo "${fieldType}" primeiro.`);

      return;

    }

    setGeoLoading(prev => ({ ...prev, [fieldType]: true }));

    setGeoError('');



    try {

      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`, {

        headers: { 'User-Agent': `AppColaAi/1.0 (${user.email})` },

        referrerPolicy: "no-referrer"

      });

      if (!response.ok) throw new Error('Falha na rede ao buscar coordenadas.');

      const data = await response.json();



      if (data && data.length > 0) {

        const { lat, lon } = data[0];

        const geoPoint = new GeoPoint(parseFloat(lat), parseFloat(lon));

       

        // Salva a coordenada específica no formData

        const locationField = fieldType === 'inicio' ? 'localizacaoInicio' : 'localizacaoDestino';

        setFormData(prev => ({ ...prev, [locationField]: geoPoint }));

        setGeocodingStatus(prev => ({ ...prev, [fieldType]: 'success' }));

      } else {

        setGeoError(`Coordenadas não encontradas para "${address}".`);

        setGeocodingStatus(prev => ({ ...prev, [fieldType]: 'error' }));

      }

    } catch (err) {

      console.error("Erro de geocodificação:", err);

      setGeoError('Ocorreu um erro ao buscar coordenadas.');

    } finally {

      setGeoLoading(prev => ({ ...prev, [fieldType]: false }));

    }

  };



  const handleSubmitRoute = async (e) => {

    e.preventDefault();

    if (!user) return;



    // Validação para garantir que as coordenadas foram obtidas

    if (!formData.localizacaoInicio || !formData.localizacaoDestino) {

      setDialogConfig({

        isOpen: true, type: 'warning', title: 'Atenção!',

        message: 'Por favor, obtenha as coordenadas para os pontos de Início e Destino antes de salvar.'

      });

      return;

    }



    const isEditing = !!editingRoute;

    try {

      if (isEditing) {

        const routeDocRef = doc(db, 'users', user.uid, 'rotas', editingRoute.id);

        await updateDoc(routeDocRef, formData);

      } else {

        const routesCollectionRef = collection(db, 'users', user.uid, 'rotas');

        await addDoc(routesCollectionRef, formData);

      }

      setShowFormModal(false);

      setDialogConfig({

        isOpen: true, type: 'success', title: 'Sucesso!',

        message: `Rota ${isEditing ? 'atualizada' : 'criada'} com sucesso.`

      });

    } catch (error) {

        console.error("Erro ao salvar rota: ", error);

        setDialogConfig({

            isOpen: true, type: 'warning', title: 'Erro!',

            message: 'Não foi possível salvar a rota. Tente novamente.'

        });

    }

  };



  const handleDeleteRoute = (routeId) => {

    setDialogConfig({

      isOpen: true,

      type: 'warning',

      title: 'Confirmar Exclusão',

      message: 'Tem certeza que deseja apagar esta rota? Esta ação não pode ser desfeita.',

      onConfirm: async () => {

        try {

            const routeDocRef = doc(db, 'users', user.uid, 'rotas', routeId);

            await deleteDoc(routeDocRef);

            setDialogConfig({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Rota apagada.' });

        } catch(error) {

            console.error("Erro ao apagar rota: ", error);

            setDialogConfig({ isOpen: true, type: 'warning', title: 'Erro', message: 'Não foi possível apagar a rota.' });

        }

      }

    });

  };



  const handleToggleStudent = (studentId) => {

    setFormData(prev => {

      const isSelected = prev.alunos_ordem.includes(studentId);

      const newAlunosOrdem = isSelected

        ? prev.alunos_ordem.filter(id => id !== studentId)

        : [...prev.alunos_ordem, studentId];

      return { ...prev, alunos_ordem: newAlunosOrdem };

    });

  };



  return (

    <div className="gerenciar-rotas-page">

      <DialogModal config={dialogConfig} setConfig={setDialogConfig} />



      <div className="page-header">

        <div>

          <h2>Gerenciar Rotas</h2>

          <p>Crie e organize suas rotas de forma inteligente.</p>

        </div>

        <button className="add-button" onClick={() => handleOpenFormModal()}>

          <FaPlus /> Nova Rota

        </button>

      </div>



      <div className="routes-list-container">

        {loading ? <p>Carregando...</p> : routes.map(route => (

          <div key={route.id} className="route-card">

            <div className="route-card-header">

              <h3>{route.nome}</h3>

              <div className="tags">

                <span className="tag-turno">{route.turno}</span>

                <span className="tag-tipo">{route.tipo || 'Coleta'}</span>

              </div>

              <div className="options-menu">

                <button className="options-btn" onClick={() => handleOpenFormModal(route)} title="Editar Rota"><FaEdit /></button>

                <button className="options-btn" onClick={() => handleDeleteRoute(route.id)} title="Apagar Rota"><FaTrashAlt /></button>

              </div>

            </div>

            <div className="route-card-body">

              <p><FaUsers /> {route.alunos_ordem.length} aluno(s) na rota</p>

              <p><FaClock /> Duração estimada: {route.duracaoEstimada || 'Não definido'}</p>

              <p><FaMapMarkerAlt /> Início: {route.inicio || 'Não definido'}</p>

              <p><FaFlagCheckered /> Destino: {route.destino || 'Não definido'}</p>

            </div>

          </div>

        ))}

        {!loading && routes.length === 0 && <p>Nenhuma rota cadastrada. Clique em "+ Nova Rota" para começar.</p>}

      </div>



      <Modal isOpen={showFormModal} onClose={() => setShowFormModal(false)} title={editingRoute ? "Editar Rota" : "Criar Nova Rota"}>

        <form onSubmit={handleSubmitRoute} className="route-modal-form">

          <div className="form-row">

            <input name="nome" value={formData.nome} onChange={handleInputChange} placeholder="Nome da Rota *" required />

            <select name="turno" value={formData.turno} onChange={handleInputChange}>

              <option value="Manhã">Manhã</option>

              <option value="Tarde">Tarde</option>

            </select>

          </div>

          <div className="form-row">

            <select name="tipo" value={formData.tipo} onChange={handleInputChange}>

              <option value="Coleta (Casa -> Escola)">Coleta (Casa → Escola)</option>

              <option value="Entrega (Escola -> Casa)">Entrega (Escola → Casa)</option>

            </select>

            <input name="duracaoEstimada" value={formData.duracaoEstimada} onChange={handleInputChange} placeholder="Duração Estimada (ex: 45 min)" />

          </div>

         

          {/* --- CAMPOS DE ENDEREÇO ATUALIZADOS --- */}

          <div className="form-group">

            <label>Ponto de Início (ex: Garagem) *</label>

            <div className="codigo-input-wrapper">

              <input name="inicio" value={formData.inicio} onChange={handleInputChange} placeholder="Digite o endereço de início" required />

              <button type="button" onClick={() => handleGeocodeAddress('inicio')} disabled={geoLoading.inicio} className="geocode-btn">

                {geoLoading.inicio ? '...' : <FaMapMarkerAlt />}

              </button>

            </div>

            {geocodingStatus.inicio === 'success' && <p className="success-message">Coordenadas de Início OK!</p>}

          </div>

         

          <div className="form-group">

            <label>Ponto de Destino (ex: Escola) *</label>

            <div className="codigo-input-wrapper">

              <input name="destino" value={formData.destino} onChange={handleInputChange} placeholder="Digite o endereço de destino" required />

              <button type="button" onClick={() => handleGeocodeAddress('destino')} disabled={geoLoading.destino} className="geocode-btn">

                {geoLoading.destino ? '...' : <FaMapMarkerAlt />}

              </button>

            </div>

            {geocodingStatus.destino === 'success' && <p className="success-message">Coordenadas de Destino OK!</p>}

          </div>

          {geoError && <p className="error-message">{geoError}</p>}



         

          <h4>Alunos da Rota ({formData.alunos_ordem.length} selecionado(s))</h4>

          <div className="students-selection-list">

            {allStudents.filter(s => s.turno === formData.turno).length > 0 ? (

                allStudents.filter(s => s.turno === formData.turno).map(student => (

                    <div key={student.id} className="student-checkbox-item">

                        <input

                            type="checkbox"

                            id={`student-${student.id}`}

                            checked={formData.alunos_ordem.includes(student.id)}

                            onChange={() => handleToggleStudent(student.id)}

                        />

                        <label htmlFor={`student-${student.id}`}>{student.nomeAluno}</label>

                    </div>

                ))

            ) : (

                <p className="no-students-message">Nenhum aluno encontrado para o turno "{formData.turno}".</p>

            )}

          </div>



          <div className="form-actions">

            <button type="button" onClick={() => setShowFormModal(false)}>Cancelar</button>

            <button type="submit">{editingRoute ? "Atualizar Rota" : "Criar Rota"}</button>

          </div>

        </form>

      </Modal>

    </div>

  );

}