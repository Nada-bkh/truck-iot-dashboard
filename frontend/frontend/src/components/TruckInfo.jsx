import React, { useState } from 'react';
import {
  Truck, Gauge, Weight, MapPin, Navigation, Clock, User, Route, Play, Square
} from 'lucide-react';

const TruckInfo = ({ truck, onClose, onRequestRoute, onStartMovement, onStopMovement }) => {
  const [showDestinationForm, setShowDestinationForm] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [isSettingRoute, setIsSettingRoute] = useState(false);

  const geocodeAddress = async (address) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
    } else {
      throw new Error('Address not found');
    }
  };

  const handleSetRoute = async (e) => {
    e.preventDefault();
    if (!destinationAddress.trim()) {
      alert('Please enter a destination address.');
      return;
    }

    setIsSettingRoute(true);
    try {
      const coords = await geocodeAddress(destinationAddress);
      if (onRequestRoute) {
        await onRequestRoute(truck, coords);
      }
      setShowDestinationForm(false);
      setDestinationAddress('');
    } catch (error) {
      alert('Geocoding failed: ' + error.message);
    } finally {
      setIsSettingRoute(false);
    }
  };

  const handleStartMovement = () => {
    if (onStartMovement && truck.route && truck.route.length > 0) {
      onStartMovement(truck);
    } else {
      alert('Please set a destination first before starting movement.');
    }
  };

  const handleStopMovement = () => {
    if (onStopMovement) {
      onStopMovement(truck);
    }
  };

  if (!truck) {
    return (
      <div className="w-80 bg-white shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Select a Truck</h2>
        <p className="text-gray-600">Click on a truck marker to view detailed information.</p>
      </div>
    );
  }

  const formatCoordinate = (coord) => {
    return typeof coord === 'number' ? coord.toFixed(4) : '0.0000';
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'moving':
      case 'en route':
        return 'text-green-600 bg-green-100';
      case 'stopped':
        return 'text-red-600 bg-red-100';
      case 'idle':
        return 'text-yellow-600 bg-yellow-100';
      case 'at destination':
        return 'text-blue-600 bg-blue-100';
      case 'maintenance':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const canStartMovement = truck.route && truck.route.length > 0 &&
    (!truck.state || truck.state === 'idle' || truck.state === 'stopped');
  const canStopMovement = truck.state === 'en route' || truck.state === 'moving';

  return (
    <div className="w-80 bg-white shadow-lg overflow-y-auto max-h-full">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Truck Details</h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Truck className="h-5 w-5 text-red-600" />
            <span className="font-medium text-gray-900">Truck ID</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{truck.id || truck.truckId || truck.truck_id || 'Unknown'}</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <div className={`h-3 w-3 rounded-full ${
              truck.state === 'en route' || truck.state === 'moving' ? 'bg-green-500' :
              truck.state === 'idle' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="font-medium text-gray-900">Status</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(truck.state || truck.status)}`}>
            {truck.state || truck.status || 'Unknown'}
          </span>
        </div>

        {truck.route_progress !== undefined && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Route className="h-5 w-5 text-indigo-600" />
              <span className="font-medium text-gray-900">Route Progress</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${truck.route_progress || 0}%` }}></div>
            </div>
            <p className="text-sm text-indigo-600 font-medium">
              {(truck.route_progress || 0).toFixed(1)}% Complete
            </p>
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Gauge className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-gray-900">Current Speed</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{Math.round(truck.speed || 0)} km/h</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Weight className="h-5 w-5 text-green-600" />
            <span className="font-medium text-gray-900">Load Weight</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{Math.round(truck.weight || 0)} kg</p>
        </div>

        {truck.driver && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <User className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-gray-900">Driver</span>
            </div>
            <p className="text-lg font-medium text-purple-600">{truck.driver}</p>
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-gray-900">Position</span>
          </div>
          <p className="text-sm text-gray-600">
            Lat: {formatCoordinate(truck.position?.[0] || truck.lat || truck.gps?.latitude)}<br />
            Lng: {formatCoordinate(truck.position?.[1] || truck.lng || truck.gps?.longitude)}
          </p>
        </div>

        {(truck.bearing !== undefined || truck.direction !== undefined) && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Navigation className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-gray-900">Bearing</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {Math.round(truck.bearing || truck.direction || 0)}°
            </p>
          </div>
        )}

        {truck.destination && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              <span className="font-medium text-gray-900">Destination</span>
            </div>
            <p className="text-sm text-gray-900">{truck.destination}</p>
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="h-5 w-5 text-gray-600" />
            <span className="font-medium text-gray-900">Last Update</span>
          </div>
          <p className="text-sm text-gray-600">
            {truck.lastUpdate ? new Date(truck.lastUpdate).toLocaleString() : 'Just now'}
          </p>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <button
            onClick={() => setShowDestinationForm(!showDestinationForm)}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            disabled={isSettingRoute}
          >
            <Route className="h-4 w-4" />
            <span>{isSettingRoute ? 'Setting Route...' : 'Set Destination'}</span>
          </button>

          {showDestinationForm && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination Address</label>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter address (e.g. Sfax, Tunisia)"
                  disabled={isSettingRoute}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSetRoute(e);
                  }}
                />
              </div>
              <button
                onClick={handleSetRoute}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                disabled={isSettingRoute}
              >
                Confirm Destination
              </button>
            </div>
          )}

          <button
            onClick={handleStartMovement}
            disabled={!canStartMovement}
            className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              canStartMovement ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Play className="h-4 w-4" />
            <span>Start Movement</span>
          </button>

          <button
            onClick={handleStopMovement}
            disabled={!canStopMovement}
            className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              canStopMovement ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Square className="h-4 w-4" />
            <span>Stop Movement</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TruckInfo;
