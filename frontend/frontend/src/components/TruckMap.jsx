import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
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

const SmoothMarker = ({ position }) => {
  const markerRef = useRef(null);
  const map = useMap();

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
      map.panTo(position, { animate: true, duration: 0.3 });
    }
  }, [position, map]);

  return <Marker position={position} ref={markerRef} />;
};

const TruckMap = ({ truckData, route }) => {
  const position = truckData.gps?.latitude && truckData.gps?.longitude ? [truckData.gps.latitude, truckData.gps.longitude] : [8.9824, -79.5199];
  const departure = route && route.departure?.latitude && route.departure?.longitude
    ? [route.departure.latitude, route.departure.longitude]
    : truckData.departure?.latitude && truckData.departure?.longitude ? [truckData.departure.latitude, truckData.departure.longitude] : [8.9824, -79.5199];
  const destination = route && route.destination?.latitude && route.destination?.longitude
    ? [route.destination.latitude, route.destination.longitude]
    : truckData.destination?.latitude && truckData.destination?.longitude ? [truckData.destination.latitude, truckData.destination.longitude] : [9.9281, -84.0907];

  console.log('TruckMap props:', { position, departure, destination });

  return (
    <MapContainer center={position} zoom={10} style={{ height: '400px', margin: '0 16px' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <SmoothMarker position={position} />
      <Marker position={destination} />
      <RoutingMachine start={departure} end={destination} />
    </MapContainer>
  );
};

export default TruckMap;