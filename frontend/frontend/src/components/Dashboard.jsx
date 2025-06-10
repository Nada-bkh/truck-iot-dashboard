import React, { useState, useEffect } from 'react';
import TruckMap from './TruckMap';
import TruckList from './TruckList';
import DestinationForm from './DestinationForm';
import TruckInfo from './TruckInfo';
import { io } from 'socket.io-client';

const Dashboard = () => {
  const [trucks, setTrucks] = useState([]);
  const [selectedTruckId, setSelectedTruckId] = useState(null);

  useEffect(() => {
    const socket = io('http://localhost:3000');
    socket.on('truckData', (data) => {
      setTrucks((prevTrucks) => {
        const existing = prevTrucks.find((t) => t.truck_id === data.truck_id);
        if (existing) {
          return prevTrucks.map((t) =>
            t.truck_id === data.truck_id ? { ...t, ...data } : t
          );
        }
        return [...prevTrucks, data];
      });
    });

    socket.on('truckRouteUpdate', (data) => {
      setTrucks((prevTrucks) =>
        prevTrucks.map((t) =>
          t.truck_id === data.truck_id ? { ...t, route: data.route } : t
        )
      );
    });

    socket.on('routeError', (err) => {
      console.error('Route error:', err.message);
    });

    socket.on('connect', () => console.log('WebSocket connected'));
    socket.on('error', (err) => console.error('WebSocket error:', err));

    return () => socket.disconnect();
  }, []);

  const handleSubmit = (routeData) => {
    const socket = io('http://localhost:3000');
    socket.emit('setRoute', {
      ...routeData,
      truck_id: selectedTruckId || trucks[0]?.truck_id,
    });
  };

  const selectedTruck = trucks.find((t) => t.truck_id === selectedTruckId) || trucks[0];

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="w-64 bg-gray-800 shadow-lg">
        <div className="p-4">
          <h1 className="text-2xl font-bold">Truck IoT Dashboard</h1>
        </div>
        <TruckList
          trucks={trucks}
          selectedTruckId={selectedTruckId}
          onSelectTruck={setSelectedTruckId}
        />
      </div>
      <div className="flex-1 flex flex-col">
        <header className="bg-gray-700 shadow p-4">
          <h2 className="text-xl font-semibold">Truck Tracking Overview</h2>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-6">
            <DestinationForm onSubmit={handleSubmit} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-700 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium">Total Trucks</h3>
              <p className="text-2xl font-bold">{trucks.length}</p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium">Active Routes</h3>
              <p className="text-2xl font-bold">
                {trucks.filter((t) => !t.is_at_destination).length}
              </p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium">Avg Weight</h3>
              <p className="text-2xl font-bold">
                {trucks.length
                  ? (
                      trucks.reduce((sum, t) => sum + t.weight, 0) / trucks.length
                    ).toFixed(2)
                  : 0}{' '}
                kg
              </p>
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg shadow overflow-hidden h-[600px]">
            <TruckMap trucks={trucks} selectedTruckId={selectedTruckId} />
          </div>
          {selectedTruck && (
            <div className="bg-gray-700 p-4 rounded-lg shadow mt-6">
              <TruckInfo truckData={selectedTruck} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;