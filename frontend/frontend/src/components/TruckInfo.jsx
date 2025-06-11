import React, { useState } from 'react';
import { Truck, Gauge, Weight, MapPin, Navigation, Clock, User, Route } from 'lucide-react';

const TruckInfo = ({ truck, onClose, onRequestRoute }) => {
  const [showDestinationForm, setShowDestinationForm] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState('');

  const geocodeAddress = async (address) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
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
    try {
      const coords = await geocodeAddress(destinationAddress);
      if (onRequestRoute) {
        onRequestRoute(truck, coords);
      }
      setShowDestinationForm(false);
      setDestinationAddress('');
    } catch (error) {
      alert('Geocoding failed: ' + error.message);
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
      case 'moving': return 'text-green-600 bg-green-100';
      case 'stopped': return 'text-red-600 bg-red-100';
      case 'idle': return 'text-yellow-600 bg-yellow-100';
      case 'maintenance': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="w-80 bg-white shadow-lg overflow-y-auto max-h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Truck Details</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Truck Information */}
      <div className="p-6 space-y-4">
        {/* Truck ID */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Truck className="h-5 w-5 text-red-600" />
            <span className="font-medium text-gray-900">Truck ID</span>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {truck.id || truck.truckId || 'Unknown'}
          </p>
        </div>

        {/* Status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <div className={`h-3 w-3 rounded-full ${truck.status === 'moving' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium text-gray-900">Status</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(truck.status)}`}>
            {truck.status || 'Unknown'}
          </span>
        </div>

        {/* Speed */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Gauge className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-gray-900">Current Speed</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {truck.speed || 0} km/h
          </p>
        </div>

        {/* Weight */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Weight className="h-5 w-5 text-green-600" />
            <span className="font-medium text-gray-900">Load Weight</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {truck.weight || 0} kg
          </p>
        </div>

        {/* Driver */}
        {truck.driver && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <User className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-gray-900">Driver</span>
            </div>
            <p className="text-lg font-medium text-purple-600">
              {truck.driver}
            </p>
          </div>
        )}

        {/* Position */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-gray-900">Position</span>
          </div>
          <p className="text-sm text-gray-600">
            Lat: {formatCoordinate(truck.position?.[0] || truck.lat)}<br />
            Lng: {formatCoordinate(truck.position?.[1] || truck.lng)}
          </p>
        </div>

        {/* Bearing */}
        {truck.bearing !== undefined && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Navigation className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-gray-900">Bearing</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {Math.round(truck.bearing)}°
            </p>
          </div>
        )}

        {/* Destination */}
        {truck.destination && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              <span className="font-medium text-gray-900">Destination</span>
            </div>
            <p className="text-sm text-gray-900">
              {truck.destination}
            </p>
          </div>
        )}

        {/* Last Update */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="h-5 w-5 text-gray-600" />
            <span className="font-medium text-gray-900">Last Update</span>
          </div>
          <p className="text-sm text-gray-600">
            {truck.lastUpdate ? new Date(truck.lastUpdate).toLocaleString() : 'Just now'}
          </p>
        </div>

        {/* Route Actions */}
      <div className="space-y-3">
        <button
          onClick={() => setShowDestinationForm(!showDestinationForm)}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Route className="h-4 w-4" />
          <span>Set Destination</span>
        </button>

        {showDestinationForm && (
          <form onSubmit={handleSetRoute} className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination Address
              </label>
              <input
                type="text"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Enter address (e.g. San Jose, Costa Rica)"
                required
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700"
              >
                Set Route
              </button>
              <button
                type="button"
                onClick={() => setShowDestinationForm(false)}
                className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-md text-sm hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  </div>
  )
};

export default TruckInfo;