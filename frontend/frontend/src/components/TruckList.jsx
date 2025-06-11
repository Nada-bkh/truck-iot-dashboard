import React from 'react';
import { Truck, MapPin, Gauge, Weight } from 'lucide-react';

const TruckList = ({ trucks, selectedTruck, onTruckSelect }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'moving': return 'bg-green-100 text-green-800';
      case 'stopped': return 'bg-red-100 text-red-800';
      case 'idle': return 'bg-yellow-100 text-yellow-800';
      case 'maintenance': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!trucks || trucks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Truck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Trucks Available</h3>
          <p className="text-gray-600">Trucks will appear here when they come online.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Active Trucks</h2>
          <p className="text-gray-600 mt-1">{trucks.length} trucks currently tracked</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trucks.map((truck) => {
            const truckId = truck.id || truck.truckId;
            const isSelected = selectedTruck && (selectedTruck.id || selectedTruck.truckId) === truckId;
            
            return (
              <div
                key={truckId}
                onClick={() => onTruckSelect(truck)}
                className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  isSelected ? 'ring-2 ring-red-500 bg-red-50' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Truck className="h-6 w-6 text-red-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {truckId}
                    </h3>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(truck.status)}`}>
                    {truck.status || 'Unknown'}
                  </span>
                </div>

                {/* Stats */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Gauge className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-gray-600">Speed:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {truck.speed || 0} km/h
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Weight className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-600">Weight:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {truck.weight || 0} kg
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-gray-600">Position:</span>
                    <span className="text-xs font-mono text-gray-900">
                      {truck.position?.[0]?.toFixed(3) || truck.lat?.toFixed(3) || '0.000'},
                      {truck.position?.[1]?.toFixed(3) || truck.lng?.toFixed(3) || '0.000'}
                    </span>
                  </div>

                  {truck.driver && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Driver:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {truck.driver}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Last update: {truck.lastUpdate ? new Date(truck.lastUpdate).toLocaleString() : 'Just now'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TruckList;