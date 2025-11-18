import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, onSnapshot, getDocs, orderBy, limit } from "firebase/firestore";
import { useAuth } from '../hooks/useAuth';
import app from '../firebaseConfig';
import CardPai from '../components/CardPai';

// --- Importações do Mapa ---
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- CSS da página ---
import './DashboardPai.css';

// --- Ícones ---
import { FaBus, FaHourglassHalf, FaUserCheck, FaUserTimes, FaMapMarkerAlt, FaCheckCircle } from 'react-icons/fa';

const db = getFirestore(app);

// --- Correção para o ícone padrão do Leaflet ---
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});
// --- Fim da correção ---


const vanIcon = new L.Icon({
  iconUrl: 'https://img.icons8.com/ios-filled/50/000000/bus.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35]
});


// Componente auxiliar para centralizar o mapa dinamicamente
function UpdateMapCenter({ position }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.flyTo(position, 16);
        }
    }, [position, map]);
    return null;
}

export default function DashboardPai() {
  const { user } = useAuth();
  const [childrenOnRoute, setChildrenOnRoute] = useState([]);
  const [activeTrajeto, setActiveTrajeto] = useState(null); // Pode ser um trajeto "em_andamento" ou "concluido"
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('A verificar rotas...');
    
  const displayName = user?.displayName || 'Responsável';

  useEffect(() => {
    if (!user) return;

    // 1. Busca os filhos do pai logado
    const alunosRef = collection(db, 'alunos');
    const qFilhos = query(alunosRef, where("responsavelUid", "==", user.uid));

    const unsubFilhos = onSnapshot(qFilhos, (snapshot) => {
      const allChildren = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (allChildren.length === 0) {
        setStatusMessage('Ainda não registou nenhum filho.');
        setLoading(false);
        return;
      }

      const motoristaIds = [...new Set(allChildren.map(c => c.motoristaId).filter(Boolean))];
      if (motoristaIds.length === 0) {
        setStatusMessage('O seu filho ainda não está vinculado a um motorista.');
        setLoading(false);
        return;
      }

      // 2. OUVINTE EM TEMPO REAL: Procura por rotas "em_andamento"
      const trajetosRef = collection(db, 'trajetos');
      const qTrajetosAtivos = query(
        trajetosRef, 
        where("motoristaId", "in", motoristaIds), 
        where("status", "==", "em_andamento")
      );
      
      const unsubTrajeto = onSnapshot(qTrajetosAtivos, (trajetoAtivoSnapshot) => {
        if (!trajetoAtivoSnapshot.empty) {
          // --- ROTA ATIVA ENCONTRADA ---
          const trajetoDoc = trajetoAtivoSnapshot.docs[0];
          const trajetoData = { id: trajetoDoc.id, ...trajetoDoc.data() };
          setActiveTrajeto(trajetoData); // Define o trajeto ativo

          const childrenInCurrentRoute = allChildren.filter(child => 
            trajetoData.paradas.some(parada => parada.alunoId === child.id)
          );
          setChildrenOnRoute(childrenInCurrentRoute);
          setLoading(false);

        } else {
          // --- NENHUMA ROTA ATIVA. PROCURA O HISTÓRICO DE HOJE ---
          setLoading(true); // Mostra carregando enquanto busca o histórico
          setStatusMessage('Nenhuma rota em andamento. A procurar histórico de hoje...');
          
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Início do dia

          const qTrajetosConcluidos = query(
            trajetosRef,
            where("motoristaId", "in", motoristaIds),
            where("status", "==", "concluido"),
            where("dataInicio", ">=", today),
            orderBy("dataInicio", "desc"),
            limit(1)
          );

          getDocs(qTrajetosConcluidos).then((trajetoConcluidoSnapshot) => {
            if (trajetoConcluidoSnapshot.empty) {
              setActiveTrajeto(null);
              setChildrenOnRoute([]);
              setStatusMessage('Ainda não há rotas para hoje.');
            } else {
              const trajetoDoc = trajetoConcluidoSnapshot.docs[0];
              const trajetoData = { id: trajetoDoc.id, ...trajetoDoc.data() };
              setActiveTrajeto(trajetoData); // Define o trajeto CONCLUÍDO

              const childrenInRoute = allChildren.filter(child => 
                trajetoData.paradas.some(parada => parada.alunoId === child.id)
              );
              setChildrenOnRoute(childrenInRoute);
            }
            setLoading(false);
          }).catch(err => {
            console.error("Erro ao buscar histórico:", err);
            // Este erro é 99% de certeza por falta de um índice no Firestore
            setStatusMessage('Erro ao buscar histórico. Verifique os índices do Firestore.');
            setLoading(false);
          });
        }
      });

      return () => unsubTrajeto();
    });

    return () => unsubFilhos();
  }, [user]);

  // Função de status atualizada para formatar a hora
  const getChildStatus = (childId) => {
    if (!activeTrajeto) return { status: 'pendente', text: 'A aguardar' };
    const parada = activeTrajeto.paradas.find(p => p.alunoId === childId);
    if (!parada) return { status: 'pendente', text: 'Fora da rota' };
    
    // Converte timestamp do Firestore para um objeto Date, se existir
    const formatTime = (timestamp) => {
      if (timestamp && timestamp.toDate) {
        return timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
      return '';
    };
    
    const time = formatTime(parada.eventoTimestamp);

    switch (parada.status) {
        case 'coletado': 
            return { status: 'embarcou', text: `Embarcou ${time ? 'às ' + time : ''}`, icon: <FaUserCheck /> };
        case 'faltou': 
            return { status: 'nao-embarcou', text: `Não Embarcou ${time ? 'às ' + time : ''}`, icon: <FaUserTimes /> };
        default: 
            return { status: 'aguardando', text: 'A aguardar', icon: <FaHourglassHalf /> };
    }
  };

  const vanPosition = activeTrajeto?.localizacaoAtualVan 
    ? [activeTrajeto.localizacaoAtualVan.latitude, activeTrajeto.localizacaoAtualVan.longitude]
    : null;

  return (
    <div className="dashboard-page-wrapper">
      <div className="dashboard-header">
        <h1>Olá, {displayName}! 👋</h1>
        <p>Acompanhe a rota em tempo real.</p>
      </div>

      {loading ? (
        <p>A carregar informações...</p>
      ) : !activeTrajeto ? (
        // --- NENHUMA ROTA ENCONTRADA ---
        <div className="no-route-message">
          <FaMapMarkerAlt size={50} color="#cbd5e1" />
          <h3>Nenhuma rota para hoje</h3>
          <p>{statusMessage}</p>
        </div>
      ) : activeTrajeto.status === 'em_andamento' && vanPosition ? (
        // --- ROTA EM ANDAMENTO (VISÃO EM TEMPO REAL) ---
        <div className="pai-dashboard-content">
          <CardPai>
            <div className="child-status-card-group">
              <h3 className="group-title">Estado da Viagem (Em Andamento)</h3>
              {childrenOnRoute.map(child => {
                const { status, text, icon } = getChildStatus(child.id);
                return (
                  <div className="child-status-item" key={child.id}>
                    <span className="child-name">{child.nomeAluno}</span>
                    <div className={`status-pill status-${status}`}>
                      {icon} {text}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardPai>
          <CardPai>
            <div className="map-wrapper">
              <MapContainer center={vanPosition} zoom={16} scrollWheelZoom={true} style={{ height: '500px', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={vanPosition} icon={vanIcon}><Popup><FaBus /> Localização atual da van.</Popup></Marker>
                <UpdateMapCenter position={vanPosition} />
              </MapContainer>
            </div>
          </CardPai>
        </div>
      ) : activeTrajeto.status === 'concluido' ? (
        // --- ROTA CONCLUÍDA (VISÃO DE HISTÓRICO) ---
        <div className="pai-dashboard-content">
          <CardPai>
            <div className="child-status-card-group">
              <h3 className="group-title">Resumo da Última Rota</h3>
              <p className="route-name-history">
                
                <strong>✅ {activeTrajeto.rotaNome}</strong> (Finalizada)
              </p>
              {childrenOnRoute.map(child => {
                const { status, text, icon } = getChildStatus(child.id);
                return (
                  <div className="child-status-item" key={child.id}>
                    <span className="child-name">Filho(a): {child.nomeAluno}</span>
                    <div className={`status-pill status-${status}`}>
                      {icon} {text}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardPai>
          {/* O mapa não é mostrado aqui, apenas o resumo */}
        </div>
      ) : (
         // Fallback (ex: rota "em_andamento" mas sem GPS ainda)
         <div className="no-route-message">
          <FaMapMarkerAlt size={50} color="#cbd5e1" />
          <h3>A carregar mapa...</h3>
          <p>{statusMessage}</p>
        </div>
      )}
    </div>
  );
}

