import React from 'react';
import { Polyline, Marker, Popup } from 'react-leaflet';

const getRouteColor = (route, isSelected) => {
  if (route.type === 'fastest') return isSelected ? '#3B82F6' : '#1E40AF';
  if (route.type === 'shortest') return isSelected ? '#10B981' : '#047857';
  return isSelected ? '#8B5CF6' : '#6D28D9';
};

const getDashArray = (route) => {
  return route.type === 'alternative' ? '10, 5' : null;
};

const calculateRealTimeETA = (route, truckSpeed) => {
  if (!route || !route.distanceKm) return { eta: 'N/A', remaining: 'N/A', speed: 0 };
  const speed = truckSpeed > 5 ? truckSpeed : route.avgSpeedKmh || 50;
  const timeHours = route.distanceKm / speed;
  const timeMinutes = timeHours * 60;
  const now = new Date();
  const eta = new Date(now.getTime() + timeMinutes * 60000);
  return {
    eta: eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    remaining: `${Math.round(timeMinutes)} min`,
    speed: Math.round(speed)
  };
};

const MultiRoutingMachine = ({ routes, selectedRouteId, onRouteSelect, truckSpeed = 50 }) => {
  if (!routes || routes.length === 0) return null;

  return (
    <>
      {routes.map((route) => {
        const isSelected = selectedRouteId === route.id;
        const color = getRouteColor(route, isSelected);
        const dashArray = getDashArray(route);
        const positions = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        const etaInfo = calculateRealTimeETA(route, truckSpeed);

        return (
          <React.Fragment key={route.id}>
            <Polyline
              positions={positions}
              color={color}
              weight={isSelected ? 8 : 5}
              opacity={isSelected ? 0.9 : 0.5}
              dashArray={dashArray}
              eventHandlers={{
                click: () => onRouteSelect && onRouteSelect(route.id),
              }}
            />
            {/* Start Marker */}
            <Marker position={positions[0]}>
              <Popup>
                <div>
                  <b>Start</b><br />
                  {route.description}<br />
                  Distance: {route.distanceKm} km<br />
                  ETA: {etaInfo.eta}
                </div>
              </Popup>
            </Marker>
            {/* End Marker */}
            <Marker position={positions[positions.length - 1]}>
              <Popup>
                <div>
                  <b>End</b><br />
                  {route.description}<br />
                  Duration: {etaInfo.remaining}<br />
                  Avg Speed: {etaInfo.speed} km/h
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default MultiRoutingMachine;