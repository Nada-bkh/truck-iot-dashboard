import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// SVG truck icon with better styling
const truckSvg = (color = '#3B82F6') => `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/>
    <path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-3c0-.6-.4-1-1-1h-5z"/>
    <circle cx="7" cy="18" r="2"/>
    <path d="M15 18H9"/>
    <circle cx="17" cy="18" r="2"/>
  </svg>
`;

const TruckMap = ({ trucks, selectedTruck, onTruckSelect, onRequestRoute, socket }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [followTruck, setFollowTruck] = useState(true);
  const [previousPositions, setPreviousPositions] = useState({});
  const mapRef = useRef(null);
  const followTimeoutRef = useRef(null);

  useEffect(() => {
    setMapLoaded(true);
  }, []);

  // Enhanced auto-follow with smooth transitions
  useEffect(() => {
    if (followTruck && selectedTruck && mapRef.current && trucks) {
      const truck = trucks?.find(t => 
        t.id === selectedTruck.id || 
        t.truckId === selectedTruck.truckId || 
        t.truck_id === selectedTruck.truck_id
      );

      if (truck) {
        let position = getTruckPosition(truck);
        if (position && Array.isArray(position) && position.length === 2) {
          // Smooth pan with higher zoom for moving trucks
          const targetZoom = truck.speed > 0 ? 16 : 14;
          
          // Use flyTo for smoother transitions
          mapRef.current.flyTo(position, targetZoom, {
            duration: 1.5,
            easeLinearity: 0.25
          });
        }
      }
    }

    return () => {
      if (followTimeoutRef.current) {
        clearTimeout(followTimeoutRef.current);
      }
    };
  }, [trucks, selectedTruck, followTruck]);

  // Track position changes for smooth animations
  useEffect(() => {
    if (trucks && Array.isArray(trucks)) {
      const newPositions = {};
      trucks.forEach(truck => {
        const truckId = truck.truck_id || truck.truckId || truck.id;
        const position = getTruckPosition(truck);
        if (position) {
          newPositions[truckId] = position;
        }
      });
      setPreviousPositions(newPositions);
    }
  }, [trucks]);

  const getTruckPosition = (truck) => {
    if (truck.position && Array.isArray(truck.position) && truck.position.length === 2) {
      return truck.position;
    } else if (truck.coordinates && Array.isArray(truck.coordinates) && truck.coordinates.length === 2) {
      return truck.coordinates;
    } else if (typeof truck.lat === 'number' && typeof truck.lng === 'number') {
      return [truck.lat, truck.lng];
    } else if (truck.gps && typeof truck.gps.latitude === 'number' && typeof truck.gps.longitude === 'number') {
      return [truck.gps.latitude, truck.gps.longitude];
    }
    return null;
  };

  const createModernTruckIcon = (truck) => {
    const isSelected = selectedTruck?.id === truck.id || 
                      selectedTruck?.truckId === truck.truckId || 
                      selectedTruck?.truck_id === truck.truck_id;

    const bearing = truck.bearing || truck.direction || 0;
    const speed = truck.speed || 0;
    const state = truck.state || 'Unknown';
    const progress = truck.route_progress || 0;
    
    // Modern color scheme
    let primaryColor, shadowColor, pulseColor;
    if (isSelected) {
      primaryColor = '#3B82F6'; // Blue for selected
      shadowColor = '#1E40AF';
      pulseColor = '#93C5FD';
    } else if (state === 'En Route' || state === 'moving') {
      primaryColor = '#10B981'; // Green for moving
      shadowColor = '#047857';
      pulseColor = '#6EE7B7';
    } else if (state === 'At Destination') {
      primaryColor = '#8B5CF6'; // Purple for arrived
      shadowColor = '#6D28D9';
      pulseColor = '#C4B5FD';
    } else {
      primaryColor = '#6B7280'; // Gray for idle
      shadowColor = '#374151';
      pulseColor = '#9CA3AF';
    }

    // Enhanced animations
    const isMoving = speed > 0;
    const pulseSpeed = Math.max(0.8, 2.5 - speed / 30);

    return L.divIcon({
      html: `
        <style>
          @keyframes modernPulse-${truck.truck_id || truck.id} {
            0% { transform: scale(1) rotate(${bearing}deg); box-shadow: 0 0 0 0 ${pulseColor}80; }
            50% { transform: scale(1.05) rotate(${bearing}deg); box-shadow: 0 0 0 8px ${pulseColor}20; }
            100% { transform: scale(1) rotate(${bearing}deg); box-shadow: 0 0 0 12px ${pulseColor}00; }
          }
          @keyframes rotate-${truck.truck_id || truck.id} {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .modern-truck-${truck.truck_id || truck.id} {
            position: relative;
            width: ${isSelected ? '60px' : '50px'};
            height: ${isSelected ? '60px' : '50px'};
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }
          .truck-main-${truck.truck_id || truck.id} {
            width: ${isSelected ? '44px' : '36px'};
            height: ${isSelected ? '44px' : '36px'};
            background: linear-gradient(135deg, ${primaryColor} 0%, ${shadowColor} 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15), 0 4px 8px rgba(0,0,0,0.1);
            border: 3px solid white;
            position: relative;
            z-index: 2;
            animation: ${isMoving ? `modernPulse-${truck.truck_id || truck.id} ${pulseSpeed}s infinite` : 'none'};
            transform: rotate(${bearing}deg);
          }
          .truck-icon-${truck.truck_id || truck.id} {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .truck-icon-${truck.truck_id || truck.id} svg {
            width: 70%;
            height: 70%;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          }
          .truck-status-ring-${truck.truck_id || truck.id} {
            position: absolute;
            top: -2px;
            right: -2px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: ${isMoving ? '#10B981' : '#EF4444'};
            border: 2px solid white;
            z-index: 3;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            ${isMoving ? `animation: rotate-${truck.truck_id || truck.id} 2s linear infinite;` : ''}
          }
          .truck-progress-${truck.truck_id || truck.id} {
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255,255,255,0.95);
            color: ${primaryColor};
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
            white-space: nowrap;
            z-index: 3;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            border: 1px solid ${primaryColor}40;
            display: ${progress > 0 ? 'block' : 'none'};
          }
          .truck-speed-indicator-${truck.truck_id || truck.id} {
            position: absolute;
            top: -8px;
            left: 50%;
            transform: translateX(-50%);
            background: ${speed > 0 ? '#10B981' : '#6B7280'};
            color: white;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 9px;
            font-weight: bold;
            z-index: 3;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            display: ${speed > 0 || isSelected ? 'block' : 'none'};
          }
        </style>
        <div class="modern-truck-${truck.truck_id || truck.id}">
          <div class="truck-main-${truck.truck_id || truck.id}">
            <div class="truck-icon-${truck.truck_id || truck.id}">
              ${truckSvg('white')}
            </div>
            <div class="truck-status-ring-${truck.truck_id || truck.id}"></div>
          </div>
          <div class="truck-speed-indicator-${truck.truck_id || truck.id}">${Math.round(speed)} km/h</div>
          <div class="truck-progress-${truck.truck_id || truck.id}">${progress.toFixed(0)}%</div>
        </div>
      `,
      className: 'modern-truck-icon',
      iconSize: [isSelected ? 60 : 50, isSelected ? 60 : 50],
      iconAnchor: [isSelected ? 30 : 25, isSelected ? 30 : 25]
    });
  };

  const getRouteColor = (truck) => {
    const isSelected = selectedTruck?.id === truck.id || 
                      selectedTruck?.truckId === truck.truckId || 
                      selectedTruck?.truck_id === truck.truck_id;

    if (isSelected) return '#3B82F6';
    if (truck.state === 'En Route' || truck.state === 'moving') return '#10B981';
    if (truck.state === 'At Destination') return '#8B5CF6';
    return '#6B7280';
  };

  const renderTruckRoute = (truck) => {
    if (!showRoutes || !truck.route || !Array.isArray(truck.route) || truck.route.length < 2) return null;

    const routePoints = truck.route.map(point => [point.latitude, point.longitude]);
    const color = getRouteColor(truck);
    const isSelected = selectedTruck?.id === truck.id || 
                      selectedTruck?.truckId === truck.truckId || 
                      selectedTruck?.truck_id === truck.truck_id;

    return (
      <React.Fragment key={`route-${truck.truck_id || truck.id}`}>
        <Polyline
          positions={routePoints}
          color={color}
          weight={isSelected ? 6 : 4}
          opacity={isSelected ? 0.9 : 0.7}
          dashArray={truck.state === 'At Destination' ? '12, 8' : null}
          lineCap="round"
          lineJoin="round"
        />
        <CircleMarker
          center={routePoints[0]}
          radius={10}
          color={color}
          fillColor="#ffffff"
          fillOpacity={1}
          weight={4}
        >
          <Popup>
            <div style={{ fontFamily: 'system-ui', minWidth: '200px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: color, fontSize: '16px', fontWeight: '600' }}>
                🏁 Start Point
              </h3>
              <p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>
                Truck: {truck.truck_id || truck.id}<br />
                Location: Tunis
              </p>
            </div>
          </Popup>
        </CircleMarker>
        <CircleMarker
          center={routePoints[routePoints.length - 1]}
          radius={10}
          color={color}
          fillColor={color}
          fillOpacity={0.9}
          weight={4}
        >
          <Popup>
            <div style={{ fontFamily: 'system-ui', minWidth: '200px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: color, fontSize: '16px', fontWeight: '600' }}>
                🎯 Destination
              </h3>
              <p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>
                Truck: {truck.truck_id || truck.id}<br />
                Location: {truck.destination || 'Unknown'}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      </React.Fragment>
    );
  };

  const handleMapClick = (e) => {
    if (selectedTruck && onRequestRoute) {
      const destination = {
        lat: e.latlng.lat,
        lng: e.latlng.lng
      };
      onRequestRoute(selectedTruck, destination);
    }
  };

  const renderTruckMarkers = () => {
    if (!trucks || !Array.isArray(trucks) || !mapLoaded) return null;

    return trucks.map(truck => {
      const truckId = truck.truck_id || truck.truckId || truck.id;
      const position = getTruckPosition(truck);

      if (!position || !Array.isArray(position) || position.length !== 2 || 
          typeof position[0] !== 'number' || typeof position[1] !== 'number' ||
          isNaN(position[0]) || isNaN(position[1]) ||
          position[0] === 0 || position[1] === 0) {
        return null;
      }

      const isSelected = selectedTruck?.id === truck.id || 
                        selectedTruck?.truckId === truck.truckId || 
                        selectedTruck?.truck_id === truck.truck_id;

      return (
        <React.Fragment key={truckId}>
          {renderTruckRoute(truck)}
          <Marker 
            position={position}
            icon={createModernTruckIcon(truck)}
            eventHandlers={{
              click: () => {
                if (onTruckSelect) onTruckSelect(truck);
              }
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'system-ui', minWidth: '320px', maxWidth: '400px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
                  color: 'white',
                  padding: '16px',
                  margin: '-9px -12px 16px -12px',
                  borderRadius: '8px 8px 0 0'
                }}>
                  <h3 style={{
                    margin: '0',
                    fontSize: '18px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '24px' }}>🚛</span> Truck {truckId}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', opacity: '0.9', fontSize: '14px' }}>
                    Live Tracking Dashboard
                  </p>
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{ 
                    padding: '12px', 
                    background: '#F8FAFC', 
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>STATUS</div>
                    <div style={{
                      color: truck.state === 'En Route' || truck.state === 'moving' ? '#10B981' : 
                             truck.state === 'At Destination' ? '#8B5CF6' : '#EF4444',
                      fontWeight: '700',
                      fontSize: '14px'
                    }}>
                      {truck.state || 'Unknown'}
                    </div>
                  </div>
                  <div style={{ 
                    padding: '12px', 
                    background: '#F8FAFC', 
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>SPEED</div>
                    <div style={{ color: '#3B82F6', fontWeight: '700', fontSize: '14px' }}>
                      {Math.round(truck.speed || 0)} km/h
                    </div>
                  </div>
                  <div style={{ 
                    padding: '12px', 
                    background: '#F8FAFC', 
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>PROGRESS</div>
                    <div style={{ color: '#8B5CF6', fontWeight: '700', fontSize: '14px' }}>
                      {(truck.route_progress || 0).toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ 
                    padding: '12px', 
                    background: '#F8FAFC', 
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>WEIGHT</div>
                    <div style={{ color: '#10B981', fontWeight: '700', fontSize: '14px' }}>
                      {Math.round(truck.weight || 0)} kg
                    </div>
                  </div>
                </div>

                {truck.driver && (
                  <div style={{
                    padding: '12px',
                    background: '#FEF3C7',
                    borderRadius: '8px',
                    border: '1px solid #F59E0B',
                    marginBottom: '16px'
                  }}>
                    <div style={{ fontSize: '12px', color: '#92400E', marginBottom: '4px' }}>DRIVER</div>
                    <div style={{ color: '#D97706', fontWeight: '600', fontSize: '14px' }}>
                      {truck.driver}
                    </div>
                  </div>
                )}

                {truck.destination && (
                  <div style={{
                    padding: '12px',
                    background: '#DBEAFE',
                    borderRadius: '8px',
                    border: '1px solid #3B82F6',
                    marginBottom: '16px'
                  }}>
                    <div style={{ fontSize: '12px', color: '#1E40AF', marginBottom: '4px' }}>🎯 DESTINATION</div>
                    <div style={{ color: '#1E3A8A', fontWeight: '600', fontSize: '14px' }}>
                      {truck.destination}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => onTruckSelect?.(truck)}
                    style={{
                      padding: '10px 16px',
                      background: isSelected ? '#EF4444' : '#3B82F6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      flex: 1,
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    {isSelected ? '✓ Selected' : 'Select'}
                  </button>
                  <button 
                    onClick={() => {
                      onTruckSelect?.(truck);
                      alert('🗺️ Click anywhere on the map to set a new destination');
                    }}
                    style={{
                      padding: '10px 16px',
                      background: '#10B981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      flex: 1,
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    📍 Route
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        </React.Fragment>
      );
    }).filter(Boolean);
  };

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative', background: '#F8FAFC' }}>
      {/* Enhanced Control Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        padding: '20px',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.05)',
        border: '1px solid rgba(255,255,255,0.3)',
        minWidth: '280px'
      }}>
        <h4 style={{ 
          margin: '0 0 16px 0', 
          color: '#1F2937', 
          fontSize: '18px', 
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          🗺️ Live Tracking Controls
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            transition: 'background 0.2s ease'
          }}>
            <input
              type="checkbox"
              checked={showRoutes}
              onChange={(e) => setShowRoutes(e.target.checked)}
              style={{ 
                cursor: 'pointer',
                width: '18px',
                height: '18px',
                accentColor: '#3B82F6'
              }}
            />
            <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
              Show Routes & Destinations
            </span>
          </label>
          
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            transition: 'background 0.2s ease'
          }}>
            <input
              type="checkbox"
              checked={followTruck}
              onChange={(e) => setFollowTruck(e.target.checked)}
              style={{ 
                cursor: 'pointer',
                width: '18px',
                height: '18px',
                accentColor: '#3B82F6'
              }}
            />
            <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
              Auto-Follow Selected Truck
            </span>
          </label>
        </div>
        
        {selectedTruck && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
            borderRadius: '10px',
            color: 'white'
          }}>
            <div style={{ fontSize: '12px', opacity: '0.8', marginBottom: '4px' }}>
              TRACKING
            </div>
            <div style={{ fontWeight: '700', fontSize: '16px' }}>
              🚛 {selectedTruck.truck_id || selectedTruck.truckId || selectedTruck.id}
            </div>
            <div style={{ fontSize: '12px', opacity: '0.9', marginTop: '4px' }}>
              {followTruck ? '📡 Live following enabled' : '📍 Static view'}
            </div>
          </div>
        )}
      </div>

      <MapContainer
        center={[36.8065, 10.1815]} // Tunis default center
        zoom={7}
        whenCreated={(mapInstance) => (mapRef.current = mapInstance)}
        style={{ height: '100%', width: '100%' }}
        onClick={handleMapClick}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {renderTruckMarkers()}
      </MapContainer>
    </div>
  );
};

export default TruckMap;