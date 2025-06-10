import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import DestinationForm from './components/DestinationForm';
import TruckMap from './components/TruckMap';
import TruckInfo from './components/TruckInfo';

function App() {
  const [truckData, setTruckData] = useState({
    truck_id: 'truck_001',
    timestamp: '',
    gps: { latitude: 8.9824, longitude: -79.5199 },
    weight: 0,
    direction: '',
    departure: { latitude: 8.9824, longitude: -79.5199 },
    destination: { latitude: 8.4273, longitude: -82.4308 },
    duration: false
  });
  const [route, setRoute] = useState(null);

  useEffect(() => {
    const socket = io('http://localhost:3000');

    socket.on('truckEvent', (data) => {
      console.log('Received truck data:', data);
      setTruckData(data);
    });

    socket.on('truckRouteUpdate', (data) => {
      console.log('Route update:', data);
      setRoute(data);
    });

    socket.on('routeError', (err) => {
      console.error('Route error:', err.message);
    });

    return () => {
      socket.disconnect();
      return;
    };
  }, []);

  const handleSubmit = async (routeData) => {
    try {
      const socket = io('http://localhost:3000');
      socket.emit('setRoute', routeData);
      setRoute(routeData);
    } catch (err) {
      console.error('Error setting route:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Truck IoT Dashboard</h1>
      <DestinationForm onSubmit={handleSubmit} />
      <TruckMap truckData={truckData} route={route} />
      <TruckInfo truckData={truckData} />
    </div>
  );
}

export default App;