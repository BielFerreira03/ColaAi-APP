import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, collectionGroup, query, where, orderBy } from 'firebase/firestore'; // Importe o orderBy
import { Link } from 'react-router-dom';
import Card from '../components/Card';
import CardPai from '../components/CardPai';
import { FaUsers, FaRoad, FaRoute, FaCheckCircle, FaSpinner } from 'react-icons/fa'; // Importe novos ícones
import { useAuth } from '../hooks/useAuth'; 
import app from '../firebaseConfig';
import './DashboardMotorista.css';

const auth = getAuth(app);
const db = getFirestore(app);

// Função para formatar o timestamp do Firestore
const formatTime = (timestamp) => {
  if (!timestamp) return 'Horário não registrado';
  return timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export default function DashboardMotorista() {
  const [totalAlunos, setTotalAlunos] = useState(0);
  const [totalRotas, setTotalRotas] = useState(0);
  const [rotasAtivas, setRotasAtivas] = useState(0);
  const [execucoesHoje, setExecucoesHoje] = useState(0);
  const [trajetosDeHoje, setTrajetosDeHoje] = useState([]); // <-- NOVO ESTADO
  const [loadingHistorico, setLoadingHistorico] = useState(true); // <-- NOVO ESTADO
  const { user } = useAuth(); 

  useEffect(() => {
    if (!user || !user.uid) return;
    
    // --- 1. Contagem de Alunos ---
    const alunosQuery = query(
      collection(db, 'alunos'),
      where('motoristaId', '==', user.uid)
    );
    const unsubStudents = onSnapshot(alunosQuery, (snapshot) => {
      setTotalAlunos(snapshot.size)
    });

    // --- 2. Contagem de Rotas ---
    const routesRef = collection(db, 'users', user.uid, 'rotas'); 
    const unsubRoutes = onSnapshot(routesRef, snapshot => {setTotalRotas(snapshot.size)});

    // --- 3. Contagem de Rotas Ativas ---
    const trajetosAtivosQuery = query(
        collection(db, 'trajetos'),
        where('motoristaId', '==', user.uid),
        where('status', '==', 'em_andamento')
    );
    const unsubAtivos = onSnapshot(trajetosAtivosQuery, (snapshot) => {
        setRotasAtivas(snapshot.size);
    });

    // --- 4. BUSCA E CONTAGEM: Execuções de Hoje ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trajetosHojeQuery = query(
        collection(db, 'trajetos'),
        where('motoristaId', '==', user.uid),
        where('dataInicio', '>=', today),
        where('dataInicio', '<', tomorrow),
        orderBy('dataInicio', 'desc') // Ordena pelas mais recentes primeiro
    );

    const unsubHoje = onSnapshot(trajetosHojeQuery, (snapshot) => {
        const listaTrajetos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTrajetosDeHoje(listaTrajetos); // Salva a lista de trajetos
        setExecucoesHoje(snapshot.size); // Salva a contagem
        setLoadingHistorico(false);
    }, (error) => {
        console.error("Erro ao buscar execuções de hoje. Verifique se o índice do Firestore foi criado.", error);
        setLoadingHistorico(false);
    });

    return () => {
      unsubStudents();
      unsubRoutes();
      unsubAtivos();
      unsubHoje();
    };
  }, [user]); 

  const displayName = user?.displayName || 'Motorista';

  return (
    <div className="dashboard-page-wrapper">
      <div className="dashboard-header">
        <h1>Olá, {displayName}! 👋</h1>
        <Link to="/executar-rota" className="header-button">Executar Rota</Link>
      </div>

      <div className="stats-cards">
        <Card title="Total de Alunos">
          <p>{totalAlunos}</p>
        </Card>
        <Card title="Rotas Ativas">
          <p>{rotasAtivas}</p>
        </Card>
        <Card title="Execuções Hoje">
          <p>{execucoesHoje}</p>
        </Card>
        <Card title="Total de Rotas">
          <p>{totalRotas}</p>
        </Card>
      </div>

      <div className="action-cards">
        <Card>
          <div className="action-card-content">
            <FaUsers size={30} color="#3b82f6" />
            <h3>Gerenciar Alunos</h3>
            <p>Cadastrar e editar informações dos seus alunos.</p>
            <Link to="/alunos" className="action-button">Acessar</Link>
          </div>
        </Card>
        <Card>
          <div className="action-card-content">
            <FaRoad size={30} color="#10b981" />
            <h3>Gerenciar Rotas</h3>
            <p>Planeje rotas e adicione alunos a elas.</p>
            <Link to="/rotas" className="action-button">Acessar</Link>
          </div>
        </Card>
        <Card>
          <div className="action-card-content">
            <FaRoute size={30} color="#8b5cf6" />
            <h3>Executar Rota</h3>
            <p>Inicie o trajeto e acompanhe em tempo real.</p>
            <Link to="/executar-rota" className="action-button">Executar</Link>
          </div>
        </Card>
      </div>

      {/* --- NOVA SEÇÃO DE HISTÓRICO --- */}
      <div className="history-section">
        <h3>Histórico de Hoje</h3>
        {loadingHistorico ? (
          <p>Carregando histórico...</p>
        ) : trajetosDeHoje.length === 0 ? (
          <CardPai>
            <p className="empty-history-message">Nenhuma rota executada hoje.</p>
          </CardPai>
        ) : (
          <div className="history-list">
            {trajetosDeHoje.map(trajeto => (
              <CardPai key={trajeto.id}>
                <div className="trajeto-history-card">
                  <div className="trajeto-info">
                    <strong>{trajeto.rotaNome}</strong>
                    <span>{trajeto.paradas.length} paradas</span>
                  </div>
                  <div className={`trajeto-status status-${trajeto.status}`}>
                    {trajeto.status === 'em_andamento' ? (
                      <><FaSpinner className="spin" /> Em Andamento</>
                    ) : (
                      <><FaCheckCircle /> Concluída às {formatTime(trajeto.dataFim)}</>
                    )}
                  </div>
                </div>
              </CardPai>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

