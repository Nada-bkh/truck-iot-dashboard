import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

const RoutingMachine = ({ start, end }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !start || !end || !Array.isArray(start) || !Array.isArray(end)) {
      console.log('Invalid routing props:', { start, end });
      return;
    }

    const routingControl = L.Routing.control({
      waypoints: [L.latLng(start[0], start[1]), L.latLng(end[0], end[1])],
      router: L.Routing.osrmv1({
        serviceUrl: 'http://localhost:5000/route/v1',
        profile: 'truck',
      }),
      lineOptions: {
        styles: [{ color: '#7e22ce', weight: 7, opacity: 0.9 }],
        extendToWaypoints: true,
      },
      createMarker: () => null,
      show: false,
      addWaypoints: false,
      routeWhileDragging: false,
      fitSelectedRoutes: true,
    }).addTo(map);

    routingControl.on('routesfound', (e) => {
      console.log('Route found:', e.routes[0].summary);
    });

    routingControl.on('routingerror', (e) => {
      console.error('Routing error:', e.error.message || e.error);
    });

    return () => {
      map.removeControl(routingControl);
    };
  }, [map, start, end]);

  return null;
};

export default RoutingMachine;