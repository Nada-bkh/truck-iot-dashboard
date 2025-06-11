import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TruckMap = ({ trucks, selectedTruck, onTruckSelect, onRequestRoute, socket }) => {
  const mapRef = useRef(null);
  const map = useRef(null);
  const truckMarkers = useRef({});
  const routePolylines = useRef({});
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current || map.current) return;

    map.current = L.map(mapRef.current, {
      center: [36.8065, 10.1815], // Default to Tunis
      zoom: 10,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map.current);

    map.current.on('click', (e) => {
      if (selectedTruck && onRequestRoute) {
        const destination = {
          lat: e.latlng.lat,
          lng: e.latlng.lng
        };
        onRequestRoute(selectedTruck, destination);
      }
    });

    setMapLoaded(true);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [selectedTruck, onRequestRoute]);

  const createTruckIcon = (truck) => {
    const isSelected = selectedTruck?.id === truck.id;
    const color = isSelected ? '#dc2626' : '#059669';
    const size = isSelected ? 28 : 24;
    
    return L.divIcon({
      html: `
        <div style="
          transform: rotate(${truck.bearing || 0}deg);
          color: ${color};
          font-size: ${size}px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
          transition: all 0.3s ease;
        ">🚛</div>
      `,
      className: 'truck-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  const createPopupContent = (truck) => {
    return `
      <div style="font-family: Arial, sans-serif; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; color: #dc2626; font-size: 16px;">
          🚛 ${truck.id || truck.truckId}
        </h3>
        <div style="font-size: 14px;">
          <p style="margin: 2px 0;"><strong>Speed:</strong> ${truck.speed || 0} km/h</p>
          <p style="margin: 2px 0;"><strong>Weight:</strong> ${truck.weight || 0} kg</p>
          <p style="margin: 2px 0;"><strong>Status:</strong> ${truck.status || 'Unknown'}</p>
          <p style="margin: 2px 0;"><strong>Driver:</strong> ${truck.driver || 'N/A'}</p>
          ${truck.destination ? `<p style="margin: 2px 0;"><strong>Destination:</strong> ${truck.destination}</p>` : ''}
        </div>
        <div style="margin-top: 8px; display: flex; gap: 4px;">
          <button 
            onclick="window.selectTruck('${truck.id || truck.truckId}')"
            style="
              padding: 4px 8px;
              background: #dc2626;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              flex: 1;
            "
          >
            Select
          </button>
          <button 
            onclick="window.setDestination('${truck.id || truck.truckId}')"
            style="
              padding: 4px 8px;
              background: #059669;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              flex: 1;
            "
          >
            Set Route
          </button>
        </div>
      </div>
    `;
  };

 useEffect(() => {
  if (!mapLoaded || !map.current || !trucks) return;

  window.selectTruck = (truckId) => {
    const truck = trucks.find(t => (t.id || t.truckId) === truckId);
    if (truck && onTruckSelect) {
      onTruckSelect(truck);
    }
  };

  window.setDestination = (truckId) => {
    const truck = trucks.find(t => (t.id || t.truckId) === truckId);
    if (truck && onTruckSelect) {
      onTruckSelect(truck);
      alert('Click on the map to set destination for this truck');
    }
  };

  trucks.forEach(truck => {
    const truckId = truck.id || truck.truckId;
    let position = truck.position || truck.coordinates || [truck.lat, truck.lng];

    if (!Array.isArray(position) || position.length !== 2 || 
        typeof position[0] !== 'number' || typeof position[1] !== 'number' ||
        isNaN(position[0]) || isNaN(position[1])) {
      console.warn(`Skipping invalid position for truck ${truckId}:`, position);
      return;
    }

    if (truckMarkers.current[truckId]) {
      truckMarkers.current[truckId].setLatLng(position);
      truckMarkers.current[truckId].setIcon(createTruckIcon(truck));
      truckMarkers.current[truckId].setPopupContent(createPopupContent(truck));
    } else {
      const marker = L.marker(position, {
        icon: createTruckIcon(truck)
      })
        .addTo(map.current)
        .bindPopup(createPopupContent(truck))
        .on('click', () => {
          if (onTruckSelect) onTruckSelect(truck);
        });

      truckMarkers.current[truckId] = marker;
    }
  });

  Object.keys(truckMarkers.current).forEach(truckId => {
    if (!trucks.find(t => (t.id || t.truckId) === truckId)) {
      map.current.removeLayer(truckMarkers.current[truckId]);
      delete truckMarkers.current[truckId];
    }
  });

  if (
    selectedTruck &&
    selectedTruck.position &&
    Array.isArray(selectedTruck.position) &&
    selectedTruck.position.length === 2 &&
    typeof selectedTruck.position[0] === 'number' &&
    typeof selectedTruck.position[1] === 'number'
  ) {
    map.current.setView(selectedTruck.position, 15);
  }
}, [trucks, selectedTruck, mapLoaded, onTruckSelect]);


  useEffect(() => {
    if (!mapRef.current || map.current) return;
    map.current = L.map(mapRef.current, {
      center: [36.8065, 10.1815],
      zoom: 10,
      zoomControl: true
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map.current);

    map.current.on('click', (e) => {
      if (selectedTruck && onRequestRoute) {
        const destination = {
          lat: e.latlng.lat,
          lng: e.latlng.lng
        };
        onRequestRoute(selectedTruck, destination);
      }
    });

    setMapLoaded(true);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); 


  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">Map Legend</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🚛</span>
            <span>Truck Position</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-1 bg-red-600 opacity-80" style={{ borderStyle: 'dashed', borderWidth: '1px 0' }}></div>
            <span>Planned Route</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            <span>Selected Truck</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-600 rounded-full"></div>
            <span>Other Trucks</span>
          </div>
        </div>
      </div>

      {/* Truck Counter */}
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🚛</span>
          <span className="font-semibold text-gray-900">
            {trucks ? trucks.length : 0} Active Trucks
          </span>
        </div>
      </div>

      {/* Map Instructions */}
      {selectedTruck && (
        <div className="absolute bottom-4 left-4 bg-blue-600 text-white p-3 rounded-lg shadow-lg max-w-xs">
          <p className="text-sm font-medium">
            Click anywhere on the map to set destination for {selectedTruck.id || selectedTruck.truckId}
          </p>
        </div>
      )}
    </div>
  );
};

export default TruckMap;