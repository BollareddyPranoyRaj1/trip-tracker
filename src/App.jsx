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
  const [mapTheme, setMapTheme] = useState('light');
  const [stats, setStats] = useState({ speed: 0, alt: 0 });
  const watchId = useRef(null);

  const mapThemes = {
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
  };

  useEffect(() => {
    localStorage.setItem("saved_trips", JSON.stringify(trips));
  }, [trips]);

  // Voice Command System
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        if (transcript.includes("start tracking")) startTracking();
        if (transcript.includes("stop session")) stopTracking();
      };
      recognition.start();
    }
  }, []);

  const startTracking = () => {
    if (isTracking) return;

    setCurrentRoute([]);
    setIsTracking(true);
    setStats({ speed: 0, alt: 0 });

    // Immediate Pulse
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

  // Theme-based Styles
  const currentWrapperStyle = mapTheme === 'dark' ? styles.appWrapperDark : styles.appWrapperLight;
  const currentFrameStyle = mapTheme === 'dark' ? styles.consoleFrameDark : styles.consoleFrameLight;
  const currentHeadingStyle = mapTheme === 'dark' ? styles.mainHeadingDark : styles.mainHeadingLight;
  const currentTelemetryBox = mapTheme === 'dark' ? styles.telemetryBoxDark : styles.telemetryBoxLight;
  const currentTelemetryValue = mapTheme === 'dark' ? styles.telemetryValueDark : styles.telemetryValueLight;
  const currentLogRow = mapTheme === 'dark' ? styles.logRowDark : styles.logRowLight;
  const currentLogDate = mapTheme === 'dark' ? styles.logDateDark : styles.logDateLight;

  return (
    <div style={currentWrapperStyle}>
      <div style={currentFrameStyle}>
        <header style={styles.header}>
          <div>
            <h1 style={currentHeadingStyle}>TRACKER_CORE v4</h1>
            <p style={styles.subtext}>// VOICE_AUTH: "START TRACKING" | "STOP SESSION"</p>
          </div>
          <div style={styles.themeCluster}>
            <button onClick={() => setMapTheme('dark')} style={mapTheme === 'dark' ? styles.activeTabDark : styles.tab}>OBSIDIAN</button>
            <button onClick={() => setMapTheme('light')} style={mapTheme === 'light' ? styles.activeTabLight : styles.tab}>ALABASTER</button>
          </div>
        </header>

        <main style={styles.layout}>
          <div style={styles.mapViewport}>
            <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url={mapThemes[mapTheme]} />
              <ChangeView center={mapCenter} zoom={15} />
              <Polyline positions={currentRoute} color={mapTheme === 'dark' ? "#00f2ff" : "#000"} weight={6} opacity={1} />
              {currentRoute.length > 0 && <Marker position={mapCenter} />}
            </MapContainer>
          </div>

          <div style={styles.dashboard}>
            <div style={styles.actionModule}>
              {!isTracking ? (
                <button onClick={startTracking} style={styles.btnInitiate}>INITIATE TRACKING</button>
              ) : (
                <button onClick={stopTracking} style={styles.btnTerminate}>TERMINATE SESSION</button>
              )}
            </div>

            <div style={styles.telemetryGrid}>
              <div style={currentTelemetryBox}>
                <span style={styles.telemetryLabel}>VELOCITY</span>
                <span style={currentTelemetryValue}>{stats.speed} <small>KM/H</small></span>
              </div>
              <div style={currentTelemetryBox}>
                <span style={styles.telemetryLabel}>ALTITUDE</span>
                <span style={currentTelemetryValue}>{stats.alt} <small>M</small></span>
              </div>
              <div style={currentTelemetryBox}>
                <span style={styles.telemetryLabel}>NODES</span>
                <span style={currentTelemetryValue}>{currentRoute.length}</span>
              </div>
              <div style={currentTelemetryBox}>
                <span style={styles.telemetryLabel}>STATUS</span>
                <span style={{ ...currentTelemetryValue, color: isTracking ? (mapTheme === 'dark' ? '#00f2ff' : '#000') : '#666' }}>
                  {isTracking ? 'ONLINE' : 'IDLE'}
                </span>
              </div>
            </div>
          </div>

          <section style={styles.logSection}>
            <h3 style={styles.logHeading}>ARCHIVED_MISSIONS</h3>
            <div style={styles.logContainer}>
              {trips.length === 0 && <p style={{textAlign: 'center', color: '#888', padding: '20px'}}>NO_RECORDS</p>}
              {trips.map(trip => (
                <div key={trip.id} style={currentLogRow}>
                  <div>
                    <span style={currentLogDate}>{trip.date}</span>
                    <span style={styles.logMeta}>{trip.path.length} NODES_STORED</span>
                  </div>
                  <button onClick={() => deleteTrip(trip.id)} style={styles.btnPurge}>PURGE</button>
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
  // Wrapper & Frame
  appWrapperLight: { backgroundColor: '#F0F0F0', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" },
  appWrapperDark: { backgroundColor: '#000', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" },
  consoleFrameLight: { width: '100%', maxWidth: '1100px', background: '#FFF', padding: '50px', border: '2px solid #000', boxShadow: '15px 15px 0px #DDD' },
  consoleFrameDark: { width: '100%', maxWidth: '1100px', background: '#0A0A0A', padding: '50px', border: '1px solid #1A1A1A' },

  // Typography
  mainHeadingLight: { fontSize: '2.5rem', fontWeight: '900', letterSpacing: '8px', color: '#000', margin: 0 },
  mainHeadingDark: { fontSize: '2.5rem', fontWeight: '900', letterSpacing: '8px', color: '#FFF', margin: 0 },
  subtext: { color: '#888', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 'bold', marginTop: '10px' },
  
  // Controls
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' },
  themeCluster: { display: 'flex', gap: '15px' },
  tab: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem' },
  activeTabLight: { background: '#000', color: '#FFF', padding: '8px 15px', border: 'none', fontWeight: 'bold', fontSize: '0.7rem' },
  activeTabDark: { background: '#FFF', color: '#000', padding: '8px 15px', border: 'none', fontWeight: 'bold', fontSize: '0.7rem' },

  // Layout
  layout: { display: 'flex', flexDirection: 'column', gap: '30px' },
  mapViewport: { height: '400px', border: '2px solid #000', overflow: 'hidden' },
  dashboard: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: '30px' },

  // Buttons
  btnInitiate: { width: '100%', padding: '20px', backgroundColor: '#000', color: '#FFF', border: 'none', fontWeight: '900', letterSpacing: '2px', cursor: 'pointer' },
  btnTerminate: { width: '100%', padding: '20px', background: 'none', border: '2px solid #FF0000', color: '#FF0000', fontWeight: '900', letterSpacing: '2px', cursor: 'pointer' },

  // Telemetry Grid
  telemetryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#DDD' },
  telemetryBoxLight: { background: '#FFF', padding: '20px' },
  telemetryBoxDark: { background: '#111', padding: '20px' },
  telemetryLabel: { fontSize: '0.6rem', color: '#888', fontWeight: 'bold', display: 'block', marginBottom: '10px' },
  telemetryValueLight: { fontSize: '1.2rem', fontWeight: '900', color: '#000' },
  telemetryValueDark: { fontSize: '1.2rem', fontWeight: '900', color: '#00f2ff' },

  // Logs
  logSection: { marginTop: '40px' },
  logHeading: { fontSize: '0.7rem', color: '#888', letterSpacing: '3px', marginBottom: '20px' },
  logContainer: { display: 'flex', flexDirection: 'column', gap: '1px', background: '#DDD' },
  logRowLight: { background: '#FFF', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logRowDark: { background: '#0A0A0A', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1A1A1A' },
  logDateLight: { fontWeight: '900', color: '#000', fontSize: '0.8rem' },
  logDateDark: { fontWeight: '900', color: '#FFF', fontSize: '0.8rem' },
  logMeta: { fontSize: '0.6rem', color: '#888', marginLeft: '15px' },
  btnPurge: { background: 'none', border: 'none', color: '#FF0000', fontSize: '0.6rem', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }
};

export default App;