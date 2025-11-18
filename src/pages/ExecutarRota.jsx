import { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, GeoPoint, query, where } from "firebase/firestore";
import { FaPlay, FaUserCheck, FaUserTimes, FaRoute, FaBullseye, FaFlagCheckered, FaDirections } from 'react-icons/fa';
import app from '../firebaseConfig';
import Card from '../components/Card';
import CardPai from '../components/CardPai';
import DialogModal from '../components/DialogModal';
import { useAuth } from '../hooks/useAuth';

// --- Importações do Mapa ---
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';

import './ExecutarRota.css';

const db = getFirestore(app);

// ATENÇÃO: Chave de API exposta. Lembre-se de proteger isso antes de ir para produção!
const GOOGLE_MAPS_API_KEY = "AIzaSyAYPADDY-o95fvtx0v3MlGEtJ64XUf_rrU";

// --- Correção para o ícone padrão do Leaflet ---
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl, iconUrl, shadowUrl,
});

// --- Ícone customizado para a van ---
const vanIcon = new L.Icon({
  iconUrl: 'https://img.icons8.com/ios-filled/50/000000/bus.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35]
});


// --- Componente de Roteirização ---
// AGORA ACEITA UM PONTO DE DESTINO GENÉRICO (ALUNO OU ESCOLA)
function Routing({ vanPosition, destination }) {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    // Se não houver destino, remove a rota anterior e sai
    if (!map || !vanPosition || !destination?.localizacao) {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
      }
      return;
    }

    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }

    const waypoints = [
      L.latLng(vanPosition[0], vanPosition[1]),
      L.latLng(destination.localizacao.latitude, destination.localizacao.longitude)
    ];

    routingControlRef.current = L.Routing.control({
      waypoints,
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
      lineOptions: { styles: [{ color: '#0d6efd', opacity: 0.8, weight: 6 }] },
      createMarker: function () { return null; }
    }).addTo(map);

  }, [map, vanPosition, destination]);

  return null;
}


export default function ExecutarRota() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [activeTrajeto, setActiveTrajeto] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const watchIdRef = useRef(null);
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false });

  // Busca rotas e TODOS os alunos do motorista
  useEffect(() => {
    if (!user) return;
    const routesRef = collection(db, 'users', user.uid, 'rotas');
    const unsubRoutes = onSnapshot(routesRef, (snapshot) => {
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const alunosRef = collection(db, 'alunos');
    const qAlunos = query(alunosRef, where("motoristaId", "==", user.uid));
    const unsubStudents = onSnapshot(qAlunos, (snapshot) => {
      setAllStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubRoutes(); unsubStudents(); };
  }, [user]);

  // "Ouvinte" do trajeto ativo
  useEffect(() => {
    if (!user) return;
    const trajetosRef = collection(db, 'trajetos');
    const q = query(trajetosRef, where("motoristaId", "==", user.uid), where("status", "==", "em_andamento"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveTrajeto({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveTrajeto(null);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Efeito do GPS
  useEffect(() => {
    const trajetoId = activeTrajeto ? activeTrajeto.id : null;
    if (!trajetoId) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (watchIdRef.current === null) {
      const trajetoDocRef = doc(db, 'trajetos', trajetoId);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          updateDoc(trajetoDocRef, {
            localizacaoAtualVan: new GeoPoint(latitude, longitude),
            ultimaAtualizacao: serverTimestamp()
          });
        },
        (error) => console.error("Erro no GPS: ", error),
        { enableHighAccuracy: true }
      );
    }
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeTrajeto ? activeTrajeto.id : null]);

  const handleStartRoute = async () => {
    setIsOptimizing(true);
    if (!user || !selectedRouteId) {
      setIsOptimizing(false);
      return;
    }
    const route = routes.find(r => r.id === selectedRouteId);
    if (!route || !route.alunos_ordem || route.alunos_ordem.length === 0) {
      alert("Esta rota não tem alunos cadastrados.");
      setIsOptimizing(false);
      return;
    }
    if (!route.localizacaoDestino) {
        alert("Esta rota não tem um Ponto de Destino com coordenadas. Edite a rota e obtenha as coordenadas do destino.");
        setIsOptimizing(false);
        return;
    }

    const studentsOnRoute = route.alunos_ordem
      .map(studentId => allStudents.find(s => s.id === studentId))
      .filter(student => student && student.localizacao);

    if (studentsOnRoute.length === 0) {
      alert("Nenhum dos alunos nesta rota possui localização cadastrada.");
      setIsOptimizing(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const currentLocation = {
        location: { latLng: { latitude: latitude, longitude: longitude } }
      };

      const waypoints = studentsOnRoute.map(student => ({
        location: { latLng: { latitude: student.localizacao.latitude, longitude: student.localizacao.longitude } }
      }));
      
      const destination = {
        location: { latLng: { latitude: route.localizacaoDestino.latitude, longitude: route.localizacaoDestino.longitude } }
      };

      const requestBody = {
        origin: currentLocation,
        destination: destination,
        intermediates: waypoints,
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        optimizeWaypointOrder: true,
      };

      try {
        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error('Falha ao otimizar a rota. Verifique a chave da API.');
        }

        const data = await response.json();
        const optimizedOrderIndexes = data.routes[0].optimizedIntermediateWaypointIndex;
        
        const orderedStudents = optimizedOrderIndexes.map(index => studentsOnRoute[index]);
        
        const paradas = orderedStudents.map(student => ({
          alunoId: student.id,
          alunoNome: student.nomeAluno,
          endereco: student.endereco,
          status: 'pendente',
          localizacao: student.localizacao,
        }));

        await addDoc(collection(db, 'trajetos'), {
          motoristaId: user.uid,
          rotaId: route.id,
          rotaNome: route.nome,
          rotaDestino: route.destino || 'Destino não informado',
          localizacaoDestino: route.localizacaoDestino, // SALVA AS COORDENADAS
          dataInicio: serverTimestamp(),
          status: 'em_andamento',
          paradas: paradas
        });

      } catch (error) {
        console.error("Erro ao otimizar ou iniciar trajeto: ", error);
        alert(error.message || "Não foi possível iniciar o trajeto.");
      } finally {
        setIsOptimizing(false);
      }
    }, (error) => {
      console.error("Erro ao obter localização para otimização:", error);
      alert("Não foi possível obter a sua localização para otimizar a rota.");
      setIsOptimizing(false);
    });
  };

  const handleUpdateParadaStatus = async (paradaIndex, novoStatus) => {
    if (!activeTrajeto) return;
    const novasParadas = [...activeTrajeto.paradas];
    novasParadas[paradaIndex].status = novoStatus;
    await updateDoc(doc(db, 'trajetos', activeTrajeto.id), { paradas: novasParadas });
  };

  const handleFinishRoute = () => {
    if (!activeTrajeto) return;
    setDialogConfig({
      isOpen: true, type: 'warning', title: 'Finalizar Rota',
      message: 'Tem certeza que deseja finalizar a rota atual?',
      onConfirm: async () => {
        await updateDoc(doc(db, 'trajetos', activeTrajeto.id), {
          status: 'concluido', dataFim: serverTimestamp()
        });
      }
    });
  };

  const handleNavigateGPS = () => {
    const proximaParada = activeTrajeto?.paradas.find(p => p.status === 'pendente');
    if (!proximaParada || !proximaParada.localizacao) {
      alert("Não há uma próxima parada definida.");
      return;
    }
    const { latitude, longitude } = proximaParada.localizacao;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // --- FUNÇÃO CORRIGIDA ---
  // Não faz mais busca na API, usa as coordenadas salvas
  const handleNavigateToDestination = () => {
    if (!activeTrajeto || !activeTrajeto.localizacaoDestino) {
      alert("Destino da rota não encontrado ou sem coordenadas. Edite a rota.");
      return;
    }
    
    // Pega as coordenadas salvas diretamente
    const { latitude, longitude } = activeTrajeto.localizacaoDestino;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    window.open(url, '_blank');
  };


  const proximaParadaIndex = activeTrajeto?.paradas.findIndex(p => p.status === 'pendente');
  const proximaParada = proximaParadaIndex !== -1 ? activeTrajeto?.paradas[proximaParadaIndex] : null;
  const vanPosition = activeTrajeto?.localizacaoAtualVan
    ? [activeTrajeto.localizacaoAtualVan.latitude, activeTrajeto.localizacaoAtualVan.longitude]
    : null;
    
  // Define qual é o próximo ponto no mapa (aluno ou escola)
  const proximoDestinoNoMapa = proximaParada || (activeTrajeto ? { 
      alunoNome: activeTrajeto.rotaDestino, 
      localizacao: activeTrajeto.localizacaoDestino 
  } : null);

  return (
    <div className="executar-rota-page">
      <DialogModal config={dialogConfig} setConfig={setDialogConfig} />
      <div className="page-header">
        <h2>Executar Rota</h2>
        <p>Inicie e gerencie o trajeto em tempo real</p>
      </div>

      {activeTrajeto ? (
        <div className="active-route-panel">

          <div className="next-stop-focus">
            {vanPosition ? (
              <div className="map-container-small">
                <MapContainer center={vanPosition} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Routing vanPosition={vanPosition} destination={proximoDestinoNoMapa} />
                  <Marker position={vanPosition} icon={vanIcon}><Popup>Sua Posição</Popup></Marker>
                  {proximoDestinoNoMapa && proximoDestinoNoMapa.localizacao && (
                    <Marker position={[proximoDestinoNoMapa.localizacao.latitude, proximoDestinoNoMapa.localizacao.longitude]}>
                      <Popup>Próximo Destino: {proximoDestinoNoMapa.alunoNome || activeTrajeto.rotaDestino}</Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
            ) : (
              <div className="map-placeholder">Aguardando GPS...</div>
            )}
            
            {proximaParada ? (
              <Card>
                <div className="next-stop-card">
                  <div className="next-stop-header">
                    <FaBullseye />
                    <h3>PRÓXIMA PARADA</h3>
                  </div>
                  <p className="next-student-name">{proximaParadaIndex + 1}. {proximaParada.alunoNome}</p>
                  <button className="gps-button" onClick={handleNavigateGPS}>
                    <FaDirections /> Navegar com GPS
                  </button>
                  <div className="parada-card-actions">
                    <button className="coletado-btn" onClick={() => handleUpdateParadaStatus(proximaParadaIndex, 'coletado')}><FaUserCheck /> Coletado</button>
                    <button className="faltou-btn" onClick={() => handleUpdateParadaStatus(proximaParadaIndex, 'faltou')}><FaUserTimes /> Faltou</button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="next-stop-card all-done">
                  <div className="next-stop-header">
                    <FaFlagCheckered />
                    <h3>ALUNOS FINALIZADOS</h3>
                  </div>
                  <p>Próximo destino: <strong>{activeTrajeto.rotaDestino}</strong></p>
                  <button className="gps-button" onClick={handleNavigateToDestination}>
                    <FaDirections /> Navegar para o Destino
                  </button>
                </div>
              </Card>
            )}
          </div>

          <div className="full-paradas-list">
            <h4>Todas as Paradas</h4>
            {activeTrajeto.paradas.map((parada, index) => (
              <div key={`${parada.alunoId}-${index}`} className={`parada-item status-${parada.status}`}>
                <span className="stop-number">{index + 1}</span>
                <span className="student-name">{parada.alunoNome}</span>
                <div className="status-icon">
                  {parada.status === 'coletado' && <FaUserCheck />}
                  {parada.status === 'faltou' && <FaUserTimes />}
                </div>
              </div>
            ))}
          </div>
          <button className="finish-route-button" onClick={handleFinishRoute}>Finalizar Rota</button>
        </div>
      ) : (
        <CardPai>
          <div className="iniciar-rota-form">
            <h3>Iniciar uma Rota</h3>
            <select value={selectedRouteId} onChange={(e) => setSelectedRouteId(e.target.value)}>
              <option value="" disabled>Selecione uma rota ativa</option>
              {loading ? <option disabled>Carregando rotas...</option> :
                routes.map(route => <option key={route.id} value={route.id}>{route.nome} ({route.turno})</option>)
              }
            </select>
            <button onClick={handleStartRoute} disabled={!selectedRouteId || loading || isOptimizing}>
              {isOptimizing ? 'A otimizar Rota...' : <><FaPlay /> Iniciar Rota Otimizada</>}
            </button>
          </div>
        </CardPai>
      )}
    </div>
  );
}

