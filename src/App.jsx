import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Polyline, useMap, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center[0] !== 20.5937) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

function App() {
  const [trips, setTrips] = useState(() => JSON.parse(localStorage.getItem("saved_trips") || "[]"));
  const [currentRoute, setCurrentRoute] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [mapTheme, setMapTheme] = useState('dark');
  const [stats, setStats] = useState({ speed: 0, alt: 0 });
  const watchId = useRef(null);

  const mapThemes = {
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
  };

  useEffect(() => {
    localStorage.setItem("saved_trips", JSON.stringify(trips));
  }, [trips]);

  const startTracking = () => {
    if (isTracking) return;
    setCurrentRoute([]);
    setIsTracking(true);
    setStats({ speed: 0, alt: 0 });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, speed, altitude } = pos.coords;
        setCurrentRoute([[latitude, longitude]]);
        setStats({ 
          speed: speed ? (speed * 3.6).toFixed(1) : 0, 
          alt: altitude ? altitude.toFixed(0) : 0 
        });
      },
      null,
      { enableHighAccuracy: true }
    );

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, altitude } = pos.coords;
        setCurrentRoute((prev) => [...prev, [latitude, longitude]]);
        setStats({ 
          speed: speed ? (speed * 3.6).toFixed(1) : 0, 
          alt: altitude ? altitude.toFixed(0) : 0 
        });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const stopTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setIsTracking(false);
      if (currentRoute.length > 1) {
        setTrips([{ id: Date.now(), date: new Date().toLocaleString().toUpperCase(), path: currentRoute }, ...trips]);
      }
    }
  };

  const deleteTrip = (id) => setTrips(trips.filter(t => t.id !== id));
  const mapCenter = currentRoute.length > 0 ? currentRoute[currentRoute.length - 1] : [20.5937, 78.9629];

  // Dynamic Styles Selection
  const theme = mapTheme === 'dark' ? styles.dark : styles.light;

  return (
    <div style={theme.wrapper}>
      {/* Font Injection */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&family=JetBrains+Mono:wght@300;700&display=swap');
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
      `}</style>

      <div style={theme.container}>
        <header style={styles.header}>
          <div>
            <h1 style={theme.heading}>gridMOOZ <span style={theme.version}>v4.0.2</span></h1>
            <p style={theme.voiceAuth}>// SYSTEM_STATUS: ENCRYPTED_TELEMETRY_LINK</p>
          </div>
          <div style={styles.themeToggle}>
            <button onClick={() => setMapTheme('dark')} style={mapTheme === 'dark' ? theme.activeTab : theme.tab}>MIDNIGHT</button>
            <button onClick={() => setMapTheme('light')} style={mapTheme === 'light' ? theme.activeTab : theme.tab}>SOLAR</button>
          </div>
        </header>

        <main style={styles.mainLayout}>
          <div style={theme.mapViewport}>
            <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url={mapThemes[mapTheme]} />
              <ChangeView center={mapCenter} zoom={15} />
              <Polyline positions={currentRoute} color={mapTheme === 'dark' ? "#00f2ff" : "#ff0055"} weight={4} opacity={0.8} />
              {currentRoute.length > 0 && <Marker position={mapCenter} />}
            </MapContainer>
          </div>

          <div style={styles.statsRow}>
            <div style={styles.controlModule}>
              {!isTracking ? (
                <button onClick={startTracking} style={theme.btnStart}>INIT_TRACKING</button>
              ) : (
                <button onClick={stopTracking} style={theme.btnStop}>TERMINATE_LINK</button>
              )}
            </div>

            <div style={styles.telemetryGrid}>
              {[
                { label: 'VELOCITY', value: stats.speed, unit: 'KM/H' },
                { label: 'ALTITUDE', value: stats.alt, unit: 'M' },
                { label: 'NODES', value: currentRoute.length, unit: 'PTS' },
                { label: 'STATUS', value: isTracking ? 'LINKED' : 'OFFLINE', special: true }
              ].map((item, idx) => (
                <div key={idx} style={theme.statBox}>
                  <span style={theme.statLabel}>{item.label}</span>
                  <span style={item.special && isTracking ? theme.statValueActive : theme.statValue}>
                    {item.value} <small style={theme.unit}>{item.unit}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <section style={styles.logSection}>
            <h3 style={theme.logHeading}>ENCRYPTED_ARCHIVE</h3>
            <div style={theme.logScroll}>
              {trips.length === 0 && <p style={theme.noRecords}>// NO_DATA_FOUND</p>}
              {trips.map(trip => (
                <div key={trip.id} style={theme.logEntry}>
                  <div style={styles.logLeft}>
                    <span style={theme.logDate}>{trip.date}</span>
                    <span style={theme.logSub}>LEN: {trip.path.length} NODES</span>
                  </div>
                  <button onClick={() => deleteTrip(trip.id)} style={theme.btnPurge}>PURGE</button>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' },
  themeToggle: { display: 'flex', gap: '5px', background: 'rgba(128,128,128,0.1)', padding: '5px', borderRadius: '4px' },
  mainLayout: { display: 'flex', flexDirection: 'column', gap: '20px' },
  statsRow: { display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px' },
  telemetryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' },
  logSection: { marginTop: '20px' },
  logLeft: { display: 'flex', flexDirection: 'column' },

  dark: {
    wrapper: { backgroundColor: '#050505', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '40px', fontFamily: "'JetBrains Mono', monospace" },
    container: { width: '100%', maxWidth: '1200px', background: 'rgba(20, 20, 20, 0.8)', border: '1px solid #333', borderRadius: '12px', padding: '40px', backdropFilter: 'blur(10px)', boxShadow: '0 0 50px rgba(0,0,0,0.5)' },
    heading: { fontFamily: "'Orbitron', sans-serif", fontSize: '2rem', color: '#FFF', letterSpacing: '4px', margin: 0, fontWeight: '900' },
    version: { color: '#00f2ff', fontSize: '0.8rem', verticalAlign: 'top' },
    voiceAuth: { color: '#00f2ff', fontSize: '0.65rem', letterSpacing: '2px', marginTop: '8px', opacity: 0.7 },
    tab: { background: 'none', border: 'none', color: '#555', fontSize: '0.6rem', padding: '8px 15px', cursor: 'pointer', fontFamily: "'Orbitron'" },
    activeTab: { background: '#00f2ff', color: '#000', border: 'none', fontSize: '0.6rem', padding: '8px 15px', borderRadius: '2px', cursor: 'pointer', fontFamily: "'Orbitron'", fontWeight: 'bold' },
    mapViewport: { height: '350px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #00f2ff33', boxShadow: 'inset 0 0 20px #000' },
    btnStart: { background: 'linear-gradient(45deg, #00f2ff, #0066ff)', color: '#000', border: 'none', padding: '20px', borderRadius: '4px', fontFamily: "'Orbitron'", fontWeight: '900', cursor: 'pointer', width: '100%', letterSpacing: '2px' },
    btnStop: { background: 'none', border: '1px solid #ff0055', color: '#ff0055', padding: '20px', borderRadius: '4px', fontFamily: "'Orbitron'", fontWeight: '900', cursor: 'pointer', width: '100%', letterSpacing: '2px' },
    statBox: { background: '#111', padding: '15px', borderLeft: '3px solid #00f2ff', display: 'flex', flexDirection: 'column' },
    statLabel: { fontSize: '0.55rem', color: '#555', marginBottom: '8px', fontWeight: 'bold' },
    statValue: { fontSize: '1.4rem', color: '#FFF', fontWeight: 'bold' },
    statValueActive: { fontSize: '1.4rem', color: '#00f2ff', fontWeight: 'bold', animation: 'pulse 1.5s infinite' },
    unit: { fontSize: '0.6rem', color: '#333' },
    logHeading: { fontSize: '0.7rem', color: '#333', borderBottom: '1px solid #222', paddingBottom: '10px', letterSpacing: '2px' },
    logScroll: { maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' },
    logEntry: { background: '#0d0d0d', padding: '15px 25px', display: 'flex', justifyContent: 'space-between', border: '1px solid #1a1a1a' },
    logDate: { color: '#FFF', fontSize: '0.75rem', fontWeight: 'bold' },
    logSub: { color: '#444', fontSize: '0.6rem' },
    btnPurge: { color: '#ff0055', background: 'none', border: 'none', textDecoration: 'underline', fontSize: '0.6rem', cursor: 'pointer' },
    noRecords: { color: '#222', textAlign: 'center', fontSize: '0.7rem' }
  },

  light: {
    wrapper: { backgroundColor: '#f4f7f6', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '40px', fontFamily: "'Inter', sans-serif" },
    container: { width: '100%', maxWidth: '1200px', background: '#FFF', borderRadius: '12px', padding: '40px', boxShadow: '20px 20px 60px #d9d9d9, -20px -20px 60px #ffffff' },
    heading: { fontFamily: "'Orbitron', sans-serif", fontSize: '2rem', color: '#1a1a1a', letterSpacing: '4px', margin: 0, fontWeight: '900' },
    version: { color: '#ff0055', fontSize: '0.8rem', verticalAlign: 'top' },
    voiceAuth: { color: '#666', fontSize: '0.65rem', letterSpacing: '2px', marginTop: '8px', fontWeight: 'bold' },
    tab: { background: 'none', border: 'none', color: '#AAA', fontSize: '0.6rem', padding: '8px 15px', cursor: 'pointer', fontFamily: "'Orbitron'" },
    activeTab: { background: '#1a1a1a', color: '#FFF', border: 'none', fontSize: '0.6rem', padding: '8px 15px', borderRadius: '2px', cursor: 'pointer', fontFamily: "'Orbitron'", fontWeight: 'bold' },
    mapViewport: { height: '350px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #f0f0f0' },
    btnStart: { background: '#1a1a1a', color: '#FFF', border: 'none', padding: '20px', borderRadius: '4px', fontFamily: "'Orbitron'", fontWeight: '900', cursor: 'pointer', width: '100%', letterSpacing: '2px' },
    btnStop: { background: 'none', border: '2px solid #ff0055', color: '#ff0055', padding: '20px', borderRadius: '4px', fontFamily: "'Orbitron'", fontWeight: '900', cursor: 'pointer', width: '100%', letterSpacing: '2px' },
    statBox: { background: '#fcfcfc', padding: '15px', borderLeft: '3px solid #ff0055', border: '1px solid #f0f0f0' },
    statLabel: { fontSize: '0.55rem', color: '#AAA', marginBottom: '8px', fontWeight: 'bold' },
    statValue: { fontSize: '1.4rem', color: '#1a1a1a', fontWeight: 'bold' },
    statValueActive: { fontSize: '1.4rem', color: '#ff0055', fontWeight: 'bold', animation: 'pulse 1.5s infinite' },
    unit: { fontSize: '0.6rem', color: '#CCC' },
    logHeading: { fontSize: '0.7rem', color: '#CCC', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px', letterSpacing: '2px' },
    logScroll: { maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' },
    logEntry: { background: '#f9f9f9', padding: '15px 25px', display: 'flex', justifyContent: 'space-between', border: '1px solid #eee' },
    logDate: { color: '#1a1a1a', fontSize: '0.75rem', fontWeight: 'bold' },
    logSub: { color: '#AAA', fontSize: '0.6rem' },
    btnPurge: { color: '#ff0055', background: 'none', border: 'none', textDecoration: 'underline', fontSize: '0.6rem', cursor: 'pointer' },
    noRecords: { color: '#eee', textAlign: 'center', fontSize: '0.7rem' }
  }
};

export default App;