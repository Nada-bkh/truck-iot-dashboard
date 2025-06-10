import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import RoutingMachine from './RoutingMachine';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SmoothMarker = ({ position, truckId, isSelected, plate, driver, state }) => {
  const markerRef = useRef(null);
  const map = useMap();

  useEffect(() => {
    if (markerRef.current && Array.isArray(position) && position.length === 2) {
      markerRef.current.setLatLng(position);
      if (isSelected) {
        map.panTo(position, { animate: true, duration: 0.2 });
      }
    }
  }, [position, map, isSelected]);

  return position && Array.isArray(position) && position.length === 2 ? (
    <Marker position={position} ref={markerRef}>
      <Popup>
        <div>
          <strong>Plate:</strong> {plate}<br />
          <strong>Driver:</strong> {driver}<br />
          <strong>State:</strong> {state}
        </div>
      </Popup>
    </Marker>
  ) : null;
};

const TruckMap = ({ trucks, selectedTruckId }) => {
  const defaultPosition = [8.9824, -79.5199]; // Panama City

  if (!trucks || !Array.isArray(trucks) || trucks.length === 0) {
    return <div className="text-white">No truck data available</div>;
  }

  return (
    <div className="w-full h-full" id="map-container" style={{ height: '600px' }}>
      <MapContainer
        center={defaultPosition}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {trucks.map((truck) => {
          const position = truck.gps?.latitude && truck.gps?.longitude
            ? [truck.gps.latitude, truck.gps.longitude]
            : defaultPosition;
          return (
            <React.Fragment key={truck.truck_id}>
              <SmoothMarker
                position={position}
                truckId={truck.truck_id}
                isSelected={truck.truck_id === selectedTruckId}
                plate={truck.plate}
                driver={truck.driver}
                state={truck.state}
              />
              {selectedTruckId === truck.truck_id && truck.route && (
                <RoutingMachine
                  start={truck.departure}
                  end={truck.destination}
                  truckId={truck.truck_id}
                />
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default TruckMap;