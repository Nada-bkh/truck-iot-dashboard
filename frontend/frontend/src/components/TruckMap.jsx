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

const TruckMap = ({ trucks, selectedTruck, onTruckSelect, onRequestRoute, socket }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const mapRef = useRef(null);

  useEffect(() => {
    setMapLoaded(true);
  }, []);

  const createTruckIcon = (truck) => {
    const isSelected = selectedTruck?.id === truck.id || 
                      selectedTruck?.truckId === truck.truckId || 
                      selectedTruck?.truck_id === truck.truck_id;

    const color = isSelected ? '#dc2626' : truck.state === 'En Route' ? '#059669' : '#6b7280';
    const size = isSelected ? 32 : 28;
    const bearing = truck.bearing || truck.direction || 0;

    return L.divIcon({
      html: `
        <div style="
          transform: rotate(${bearing}deg);
          color: ${color};
          font-size: ${size}px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        ">🚛</div>
      `,
      className: 'truck-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  const getRouteColor = (truck) => {
    const isSelected = selectedTruck?.id === truck.id || 
                      selectedTruck?.truckId === truck.truckId || 
                      selectedTruck?.truck_id === truck.truck_id;

    if (isSelected) return '#dc2626';
    if (truck.state === 'En Route') return '#059669';
    if (truck.state === 'At Destination') return '#6b7280';
    return '#3b82f6';
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
          weight={isSelected ? 4 : 2}
          opacity={isSelected ? 0.8 : 0.5}
          dashArray={truck.state === 'At Destination' ? '5, 5' : null}
        />
        <CircleMarker
          center={routePoints[0]}
          radius={6}
          color={color}
          fillColor="#ffffff"
          fillOpacity={1}
          weight={2}
        >
          <Popup>
            <strong>🏁 Start Point</strong><br />
            {truck.truck_id || truck.id}<br />
            Tunis
          </Popup>
        </CircleMarker>
        <CircleMarker
          center={routePoints[routePoints.length - 1]}
          radius={6}
          color={color}
          fillColor={color}
          fillOpacity={0.8}
          weight={2}
        >
          <Popup>
            <strong>🎯 Destination</strong><br />
            {truck.truck_id || truck.id}<br />
            {truck.destination || 'Unknown'}
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

      let position = null;
      if (truck.position && Array.isArray(truck.position) && truck.position.length === 2) {
        position = truck.position;
      } else if (truck.coordinates && Array.isArray(truck.coordinates) && truck.coordinates.length === 2) {
        position = truck.coordinates;
      } else if (typeof truck.lat === 'number' && typeof truck.lng === 'number') {
        position = [truck.lat, truck.lng];
      } else if (truck.gps && typeof truck.gps.latitude === 'number' && typeof truck.gps.longitude === 'number') {
        position = [truck.gps.latitude, truck.gps.longitude];
      }

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
            icon={createTruckIcon(truck)}
            eventHandlers={{
              click: () => {
                if (onTruckSelect) onTruckSelect(truck);
              }
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'Arial, sans-serif', minWidth: '250px' }}>
                <h3 style={{
                  margin: '0 0 12px 0', 
                  color: '#dc2626', 
                  fontSize: '18px',
                  borderBottom: '2px solid #dc2626',
                  paddingBottom: '8px'
                }}>
                  🚛 {truckId}
                </h3>
                <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><strong>Driver:</strong><br/><span style={{color: '#059669'}}>{truck.driver || 'N/A'}</span></div>
                    <div><strong>Plate:</strong><br/><span style={{color: '#059669'}}>{truck.plate || 'N/A'}</span></div>
                    <div><strong>Status:</strong><br/><span style={{
                      color: truck.state === 'En Route' ? '#059669' : truck.state === 'At Destination' ? '#6b7280' : '#dc2626',
                      fontWeight: 'bold'
                    }}>{truck.state || 'Unknown'}</span></div>
                    <div><strong>Speed:</strong><br/><span style={{color: '#3b82f6'}}>{Math.round(truck.speed || 0)} km/h</span></div>
                    <div><strong>Weight:</strong><br/><span style={{color: '#f59e0b'}}>{Math.round(truck.weight || 0)} kg</span></div>
                    <div><strong>Progress:</strong><br/><span style={{color: '#8b5cf6'}}>{(truck.route_progress || 0).toFixed(1)}%</span></div>
                  </div>
                  {truck.destination && (
                    <div style={{marginTop: '8px', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px'}}>
                      <strong>🎯 Destination:</strong> {truck.destination}
                    </div>
                  )}
                </div>
                <div style={{marginTop: '12px', display: 'flex', gap: '6px'}}>
                  <button 
                    onClick={() => onTruckSelect?.(truck)}
                    style={{
                      padding: '8px 12px',
                      background: isSelected ? '#dc2626' : '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      flex: 1
                    }}
                  >
                    {isSelected ? '✓ Selected' : 'Select Truck'}
                  </button>
                  <button 
                    onClick={() => {
                      onTruckSelect?.(truck);
                      alert('🗺️ Click anywhere on the map to set a new destination for this truck');
                    }}
                    style={{
                      padding: '8px 12px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      flex: 1
                    }}
                  >
                    Set Route
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
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
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
