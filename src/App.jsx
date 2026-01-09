import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Polyline, useMap, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Asset Fix
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const getPreciseDistance = (p1, p2) => {
  const R = 6371e3; 
  const φ1 = p1[0] * Math.PI/180;
  const φ2 = p2[0] * Math.PI/180;
  const Δφ = (p2[0]-p1[0]) * Math.PI/180;
  const Δλ = (p2[1]-p1[1]) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
};

function ChangeView({ center, isLocked }) {
  const map = useMap();
  useEffect(() => { if (isLocked && center) map.setView(center, map.getZoom()); }, [center, isLocked, map]);
  return null;
}

function App() {
  const [trips, setTrips] = useState(() => JSON.parse(localStorage.getItem("saved_trips") || "[]"));
  const [currentRoute, setCurrentRoute] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [stats, setStats] = useState({ speed: 0, alt: 0, distance: 0, topSpeed: 0 });
  const [speedHistory, setSpeedHistory] = useState([]); 
  const [debugMsg, setDebugMsg] = useState("SYSTEM_ONLINE");

  const routeRef = useRef([]);
  const watchId = useRef(null);

  useEffect(() => { localStorage.setItem("saved_trips", JSON.stringify(trips)); }, [trips]);

  const startTracking = () => {
    if (isTracking) return;
    setDebugMsg("UPLINK_ESTABLISHING...");
    setCurrentRoute([]);
    routeRef.current = [];
    setIsTracking(true);
    setStats({ speed: 0, alt: 0, distance: 0, topSpeed: 0 });

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, altitude } = pos.coords;
        const kmh = speed ? (speed * 3.6) : 0;
        const newPoint = [latitude, longitude];
        
        // Always set the first point
        if (routeRef.current.length === 0) {
          routeRef.current = [newPoint];
          setCurrentRoute([newPoint]);
          return;
        }

        const lastPoint = routeRef.current[routeRef.current.length - 1];
        const distChange = getPreciseDistance(lastPoint, newPoint);
        
        // Threshold check (10 meters)
        if (distChange > 10) {
          routeRef.current = [...routeRef.current, newPoint];
          setCurrentRoute([...routeRef.current]);
          setSpeedHistory(prev => [...prev.slice(-40), kmh]); 
          setStats(s => ({ 
            ...s, distance: s.distance + (distChange/1000), speed: kmh.toFixed(1), 
            topSpeed: Math.max(parseFloat(s.topSpeed), kmh).toFixed(1), alt: altitude ? altitude.toFixed(0) : s.alt 
          }));
          setDebugMsg("DATA_STREAM_ACTIVE");
        }
      },
      (err) => setDebugMsg(`SIGNAL_LOSS: ${err.message.toUpperCase()}`),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const stopTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      setIsTracking(false);
      
      if (routeRef.current.length >= 1) {
        const name = prompt("SAVE_PATH_AS:", `LOG_${new Date().toLocaleTimeString()}`);
        const newTrip = { 
          id: Date.now(), 
          name: name || "UNNAMED_PATH", 
          distance: stats.distance.toFixed(2), 
          path: routeRef.current, 
          topSpeed: stats.topSpeed 
        };
        setTrips(prev => [newTrip, ...prev]);
        setDebugMsg("PATH_SECURED");
      } else {
        setDebugMsg("INSUFFICIENT_DATA");
      }
    }
  };

  const deleteTrip = (e, id) => {
    e.stopPropagation(); // Prevents loading the trip when clicking delete
    setTrips(trips.filter(t => t.id !== id));
  };

  const mapCenter = (currentRoute.length > 0 ? currentRoute[currentRoute.length - 1] : [20.5937, 78.9629]);

  return (
    <div className="app-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@700&family=JetBrains+Mono:wght@400;700&display=swap');
        :root { --neon: #00FF41; --bg: #000; --panel: #080808; --border: #111; }
        body { margin: 0; background: var(--bg); color: #fff; font-family: 'JetBrains Mono', monospace; overflow: hidden; }
        .leaflet-container { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
        .app-wrapper { display: flex; width: 100vw; height: 100vh; flex-direction: column; }

        .main-content { height: 50vh; flex-shrink: 0; position: relative; border-bottom: 2px solid var(--border); order: 1; }
        .sidebar { height: 50vh; width: 100%; background: var(--panel); padding: 15px; box-sizing: border-box; display: flex; flex-direction: column; overflow-y: auto; z-index: 100; order: 2; }

        .stats-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0; }
        .stat-box { background: #000; border: 1px solid var(--border); padding: 10px; }
        .stat-label { font-size: 0.5rem; color: #444; margin-bottom: 5px; }
        .stat-val { font-size: 1.1rem; font-weight: bold; }

        .trip-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border); cursor: pointer; }
        .del-btn { background: none; border: 1px solid #300; color: #600; font-size: 0.5rem; padding: 2px 5px; cursor: pointer; }
        .del-btn:hover { background: #600; color: #fff; }

        @media (min-width: 992px) {
          .app-wrapper { flex-direction: row; }
          .sidebar { width: 380px; height: 100vh; border-bottom: none; border-right: 1px solid var(--border); order: 1; }
          .main-content { flex-grow: 1; height: 100vh; order: 2; }
        }

        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.2; } 100% { opacity: 1; } }
        .blink { color: var(--neon); animation: blink 1.5s infinite; }
      `}</style>

      <main className="main-content">
        <div style={{position: 'absolute', top: '15px', right: '15px', zIndex: 1000}}>
          <button onClick={() => setIsLocked(!isLocked)} style={{ background: isLocked ? 'var(--neon)' : 'rgba(0,0,0,0.8)', color: isLocked ? '#000' : '#555', border: 'none', padding: '8px 15px', fontFamily: 'Syncopate', fontSize: '0.55rem', cursor: 'pointer' }}>
            {isLocked ? "LOCK: ON" : "LOCK: OFF"}
          </button>
        </div>
        <MapContainer center={mapCenter} zoom={15} zoomControl={false} style={{width: '100%', height: '100%'}}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <ChangeView center={mapCenter} isLocked={isLocked} />
          <Polyline positions={currentRoute} color="var(--neon)" weight={4} opacity={0.8} />
          <Marker position={mapCenter} />
        </MapContainer>
      </main>

      <aside className="sidebar">
        <div className="header">
          <h1 style={{fontFamily: 'Syncopate', margin: 0}}>GRID_MOOZ <small style={{fontSize: '0.5rem', color: 'var(--neon)'}}>V15_PRO</small></h1>
          <p style={{fontSize: '0.6rem', color: '#444'}}><span className="blink">●</span> {debugMsg}</p>
        </div>

        <div className="stats-row">
          <div className="stat-box">
            <div className="stat-label">VELOCITY</div>
            <div className="stat-val" style={{color: 'var(--neon)'}}>{stats.speed} <small style={{fontSize: '0.5rem'}}>KM/H</small></div>
          </div>
          <div className="stat-box">
            <div className="stat-label">ODOMETER</div>
            <div className="stat-val">{stats.distance} <small style={{fontSize: '0.5rem'}}>KM</small></div>
          </div>
        </div>

        <button onClick={isTracking ? stopTracking : startTracking} style={{ background: isTracking ? '#FF3B30' : '#FFF', color: '#000', border: 'none', padding: '18px', fontFamily: 'Syncopate', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' }}>
          {isTracking ? "TERMINATE_UPLINK" : "INITIATE_UPLINK"}
        </button>

        <div className="archive-area" style={{marginTop: '20px'}}>
          <div style={{fontSize: '0.55rem', color: '#333', marginBottom: '10px', letterSpacing: '2px'}}>DATA_ARCHIVE</div>
          {trips.length === 0 && <div style={{fontSize:'0.6rem', color:'#222'}}>NO_SAVED_LOGS</div>}
          {trips.map(t => (
            <div key={t.id} className="trip-item" onClick={() => {setCurrentRoute(t.path); setStats({...stats, distance: t.distance})}}>
              <div>
                <div style={{fontSize:'0.75rem'}}>{t.name}</div>
                <div style={{fontSize:'0.6rem', color:'#444'}}>{t.distance} KM | {t.path.length} POINTS</div>
              </div>
              <button className="del-btn" onClick={(e) => deleteTrip(e, t.id)}>DELETE</button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default App;