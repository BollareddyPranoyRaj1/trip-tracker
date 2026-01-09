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
  const [debugMsg, setDebugMsg] = useState("SYSTEM_ONLINE");
  const [playbackPos, setPlaybackPos] = useState(null);

  const routeRef = useRef([]);
  const watchId = useRef(null);
  const playbackInterval = useRef(null);

  useEffect(() => { localStorage.setItem("saved_trips", JSON.stringify(trips)); }, [trips]);

  const startTracking = () => {
    if (isTracking) return;
    setPlaybackPos(null);
    setIsTracking(true);
    setStats({ speed: 0, alt: 0, distance: 0, topSpeed: 0 });
    setCurrentRoute([]);
    routeRef.current = [];

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, altitude } = pos.coords;
        const kmh = speed ? (speed * 3.6) : 0;
        const newPoint = [latitude, longitude];
        if (routeRef.current.length === 0) { routeRef.current = [newPoint]; setCurrentRoute([newPoint]); return; }
        const lastPoint = routeRef.current[routeRef.current.length - 1];
        const distChange = getPreciseDistance(lastPoint, newPoint);
        
        if (distChange > 10) {
          routeRef.current = [...routeRef.current, newPoint];
          setCurrentRoute([...routeRef.current]);
          setStats(s => ({ 
            ...s, distance: s.distance + (distChange/1000), speed: kmh.toFixed(1), 
            topSpeed: Math.max(parseFloat(s.topSpeed), kmh).toFixed(1), alt: altitude ? altitude.toFixed(0) : s.alt 
          }));
          setDebugMsg("STREAM_ACTIVE");
        }
      },
      (err) => setDebugMsg(`ERR: ${err.message}`),
      { enableHighAccuracy: true }
    );
  };

  const stopTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      setIsTracking(false);
      if (routeRef.current.length >= 1) {
        const name = prompt("SAVE_PATH:", `LOG_${new Date().toLocaleTimeString()}`);
        setTrips([{ id: Date.now(), name: name || "VOID", distance: stats.distance.toFixed(2), path: routeRef.current }, ...trips]);
      }
    }
  };

  const deleteTrip = (e, id) => {
    e.stopPropagation();
    setTrips(trips.filter(t => t.id !== id));
  };

  const runReplay = (path) => {
    let i = 0;
    clearInterval(playbackInterval.current);
    playbackInterval.current = setInterval(() => {
      if (i < path.length) {
        setPlaybackPos(path[i]);
        i++;
      } else {
        clearInterval(playbackInterval.current);
        setPlaybackPos(null);
      }
    }, 150);
  };

  const mapCenter = playbackPos || (currentRoute.length > 0 ? currentRoute[currentRoute.length - 1] : [20.5937, 78.9629]);

  return (
    <div className="app-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@700&family=JetBrains+Mono:wght@400;700&display=swap');
        :root { --neon: #00FF41; --bg: #000; --panel: #080808; --border: #111; }
        body { margin: 0; background: var(--bg); color: #fff; font-family: 'JetBrains Mono', monospace; overflow: hidden; }
        .leaflet-container { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); width: 100%; height: 100%; }
        
        /* 100% Fit Layout */
        .app-wrapper { display: flex; flex-direction: column; width: 100vw; height: 100vh; overflow: hidden; }

        /* Mobile Layout */
        .main-content { height: 50vh; width: 100%; position: relative; border-bottom: 2px solid var(--border); flex-shrink: 0; }
        .sidebar { height: 50vh; width: 100%; background: var(--panel); padding: 20px; box-sizing: border-box; display: flex; flex-direction: column; overflow-y: auto; }

        /* Desktop Layout Override - Perfect Side-by-Side */
        @media (min-width: 992px) {
          .app-wrapper { flex-direction: row; }
          .sidebar { width: 400px; height: 100vh; border-right: 1px solid var(--border); border-bottom: none; flex-shrink: 0; }
          .main-content { flex-grow: 1; height: 100vh; border-bottom: none; }
        }

        .stats-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
        .stat-box { background: #000; border: 1px solid var(--border); padding: 12px; }
        .stat-label { font-size: 0.5rem; color: #444; margin-bottom: 5px; letter-spacing: 1px; }
        .stat-val { font-size: 1.2rem; font-weight: bold; }

        .trip-item { border-bottom: 1px solid var(--border); padding: 15px 0; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .btn-replay { background: var(--neon); color: #000; border: none; padding: 4px 8px; font-family: 'Syncopate'; font-size: 0.5rem; font-weight: bold; cursor: pointer; margin-right: 10px; }
        .btn-del { background: none; border: 1px solid #300; color: #500; font-size: 0.5rem; padding: 4px; cursor: pointer; }

        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.2; } 100% { opacity: 1; } }
        .blink { color: var(--neon); animation: blink 1.5s infinite; }
      `}</style>

      {/* Sidebar is FIRST in DOM for Desktop Left Placement */}
      <aside className="sidebar">
        <div className="header">
          <h1 style={{fontFamily: 'Syncopate', fontSize: '1.1rem', margin: 0}}>GRID_MOOZ <small style={{fontSize: '0.4rem', color: 'var(--neon)'}}>V18</small></h1>
          <p style={{fontSize: '0.6rem', color: '#444', marginBottom: '20px'}}><span className="blink">●</span> {debugMsg}</p>
        </div>

        <div className="stats-row">
          <div className="stat-box">
            <div className="stat-label">VELOCITY</div>
            <div className="stat-val" style={{color: 'var(--neon)'}}>{stats.speed}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">ODOMETER</div>
            <div className="stat-val">{stats.distance}</div>
          </div>
        </div>

        <button 
          onClick={isTracking ? stopTracking : startTracking} 
          style={{ background: isTracking ? '#FF3B30' : '#FFF', color: '#000', border: 'none', padding: '18px', fontFamily: 'Syncopate', fontWeight: 'bold', cursor: 'pointer', marginBottom: '25px', width: '100%' }}
        >
          {isTracking ? "TERMINATE_UPLINK" : "INITIATE_UPLINK"}
        </button>

        <div style={{fontSize: '0.55rem', color: '#333', marginBottom: '10px', letterSpacing: '2px'}}>DATA_ARCHIVE</div>
        <div style={{flexGrow: 1}}>
          {trips.map(t => (
            <div key={t.id} className="trip-item" onClick={() => {setCurrentRoute(t.path); setStats({...stats, distance: t.distance})}}>
              <div>
                <div style={{fontSize: '0.8rem'}}>{t.name}</div>
                <div style={{fontSize: '0.6rem', color: '#444'}}>{t.distance} KM</div>
              </div>
              <div style={{display: 'flex', alignItems: 'center'}}>
                <button className="btn-replay" onClick={(e) => { e.stopPropagation(); runReplay(t.path); }}>REPLAY</button>
                <button className="btn-del" onClick={(e) => deleteTrip(e, t.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="main-content">
        <div style={{position: 'absolute', top: '20px', right: '20px', zIndex: 1000}}>
          <button onClick={() => setIsLocked(!isLocked)} style={{ background: isLocked ? 'var(--neon)' : 'rgba(0,0,0,0.8)', color: isLocked ? '#000' : '#FFF', border: 'none', padding: '10px 20px', fontFamily: 'Syncopate', fontSize: '0.6rem', cursor: 'pointer', boxShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
            {isLocked ? "LOCK: ON" : "FREE_CAM"}
          </button>
        </div>
        <MapContainer center={mapCenter} zoom={15} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <ChangeView center={mapCenter} isLocked={isLocked} />
          <Polyline positions={currentRoute} color="var(--neon)" weight={4} opacity={0.8} />
          <Marker position={mapCenter} />
        </MapContainer>
      </main>
    </div>
  );
}

export default App;