import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TruckMap from './TruckMap';
import TruckInfo from './TruckInfo';
import TruckList from './TruckList';
import { Truck, Map, List, Info } from 'lucide-react';
import { io } from 'socket.io-client';

const Dashboard = () => {
  const [trucks, setTrucks] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [activeView, setActiveView] = useState('map');
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);

  const usineLocation = useMemo(() => ({
    latitude: 36.8000,
    longitude: 10.1800,
  }), []);

  const updateTruck = useCallback((updatedTruck) => {
    setTrucks(prevTrucks => {
      const truckIndex = prevTrucks.findIndex(
        t => (t.id || t.truckId) === (updatedTruck.id || updatedTruck.truckId)
      );

      if (truckIndex >= 0) {
        const existingTruck = prevTrucks[truckIndex];
        
        const hasChanges = 
          existingTruck.lat !== updatedTruck.lat ||
          existingTruck.lng !== updatedTruck.lng ||
          existingTruck.speed !== updatedTruck.speed ||
          existingTruck.weight !== updatedTruck.weight ||
          existingTruck.bearing !== updatedTruck.bearing ||
          existingTruck.status !== updatedTruck.status;

        if (!hasChanges) return prevTrucks;

        const newTrucks = [...prevTrucks];
        newTrucks[truckIndex] = { 
          ...existingTruck, 
          ...updatedTruck,
          lastUpdate: new Date().toISOString()
        };
        return newTrucks;
      } else {
        return [...prevTrucks, {
          ...updatedTruck,
          lastUpdate: new Date().toISOString()
        }];
      }
    });

    setSelectedTruck(prevSelected => {
      if (prevSelected && (prevSelected.id || prevSelected.truckId) === (updatedTruck.id || updatedTruck.truckId)) {
        return { ...prevSelected, ...updatedTruck };
      }
      return prevSelected;
    });
  }, []);

  useEffect(() => {
    const newSocket = io('http://localhost:3000', {
      cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling'], 
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('truckUpdate', (data) => {
      console.log('Received truck update:', data);
      updateTruck(data);
    });

    newSocket.on('truckRouteUpdate', (data) => {
      console.log('Received route update:', data);
      const { truck_id, route } = data;

      if (!route || !Array.isArray(route) || route.length < 2) {
        console.warn('Invalid route data received:', data);
        return;
      }

      setTrucks(prevTrucks => {
        return prevTrucks.map(truck => {
          if ((truck.id || truck.truckId) === truck_id) {
            return {
              ...truck,
              remainingPath: route.map(point => [point.latitude, point.longitude]),
              route: route,
              routeUpdateTime: Date.now()
            };
          }
          return truck;
        });
      });

      setSelectedTruck(prev => {
        if (prev && (prev.id || prev.truckId) === truck_id) {
          return {
            ...prev,
            remainingPath: route.map(point => [point.latitude, point.longitude]),
            route: route,
            routeUpdateTime: Date.now()
          };
        }
        return prev;
      });
    });

    newSocket.on('routeError', (error) => {
      console.error('Route error:', error);
      
      let errorMessage = 'Unable to calculate route';
      if (error.message) {
        if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Routing service is temporarily unavailable. Please try again later.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Route calculation timed out. Please try again.';
        } else {
          errorMessage = `Route Error: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    });

    newSocket.on('message', (data) => {
      console.log('Received message:', data);

      if (data.type === 'truck_location') {
        updateTruck({
          id: data.truck_id,
          truckId: data.truck_id,
          position: [data.latitude, data.longitude],
          lat: data.latitude,
          lng: data.longitude,
          speed: data.speed || 0,
          weight: data.weight || 0,
          bearing: data.bearing,
          status: data.status || 'Unknown'
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [updateTruck]);

  const handleTruckSelect = useCallback((truck) => {
    setSelectedTruck(truck);
    setActiveView('info');
  }, []);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
  }, []);

  const requestRoute = useCallback((truck, destination) => {
    if (!socket || !isConnected) {
      alert('Not connected to server. Please wait for connection.');
      return;
    }

    if (!destination || (!destination.lat && !destination[0])) {
      alert('Invalid destination provided.');
      return;
    }

    const departure = {
      latitude: usineLocation.latitude,
      longitude: usineLocation.longitude
    };

    const dest = {
      latitude: destination.lat || destination[0],
      longitude: destination.lng || destination[1]
    };

    console.log('Requesting route:', { departure, destination: dest, truck_id: truck.id || truck.truckId });

    socket.emit('setRoute', {
      departure,
      destination: dest,
      truck_id: truck.id || truck.truckId
    });
  }, [socket, isConnected, usineLocation]);

  const memoizedTrucks = useMemo(() => trucks, [trucks]);

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Truck className="h-8 w-8 text-red-600" />
            <h1 className="text-2xl font-bold text-gray-900">Heavy Truck Tracking - Tunisia</h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} transition-colors`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Trucks Count */}
            <div className="text-sm text-gray-600">
              {memoizedTrucks.length} {memoizedTrucks.length === 1 ? 'Truck' : 'Trucks'}
            </div>

            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => handleViewChange('map')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'map'
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Map className="h-4 w-4 inline mr-2" />
                Map
              </button>
              <button
                onClick={() => handleViewChange('list')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'list'
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="h-4 w-4 inline mr-2" />
                List
              </button>
              <button
                onClick={() => handleViewChange('info')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'info'
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                disabled={!selectedTruck}
              >
                <Info className="h-4 w-4 inline mr-2" />
                Info
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Main View */}
        <div className="flex-1">
          {activeView === 'map' && (
            <TruckMap
              trucks={memoizedTrucks}
              selectedTruck={selectedTruck}
              onTruckSelect={handleTruckSelect}
              onRequestRoute={requestRoute}
              socket={socket}
              usineLocation={usineLocation}
            />
          )}
          {activeView === 'list' && (
            <TruckList
              trucks={memoizedTrucks}
              selectedTruck={selectedTruck}
              onTruckSelect={handleTruckSelect}
              onRequestRoute={requestRoute}
            />
          )}
          {activeView === 'info' && (
            <div className="w-full flex justify-center items-start p-8">
              {selectedTruck ? (
                <TruckInfo
                  truck={selectedTruck}
                  onClose={() => setActiveView('map')}
                  onRequestRoute={requestRoute}
                />
              ) : (
                <div className="text-center text-gray-500 mt-20">
                  <Truck className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">No Truck Selected</h3>
                  <p>Select a truck from the map or list to view detailed information.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side Panel - Always show info when map is active and truck is selected */}
        {activeView === 'map' && selectedTruck && (
          <TruckInfo
            truck={selectedTruck}
            onClose={() => setSelectedTruck(null)}
            onRequestRoute={requestRoute}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;