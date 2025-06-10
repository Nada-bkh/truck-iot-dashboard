import React from 'react';

const TruckInfo = ({ truckData }) => {
  return (
    <div className="p-4 bg-white shadow-md rounded-lg max-w-3xl mx-auto mt-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Truck Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p><strong>Truck ID:</strong> {truckData.truck_id}</p>
          <p><strong>Timestamp:</strong> {truckData.timestamp}</p>
          <p><strong>Weight:</strong> {truckData.weight.toFixed(2)} kg</p>
          <p><strong>Direction:</strong> {truckData.direction ? `${truckData.direction.toFixed(1)}°` : 'N/A'}</p>
          <p>
            <strong>Status:</strong>
            <span
              className={`ml-2 px-2 py-1 rounded-full text-sm ${
                truckData.is_at_destination ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
              }`}
            >
              {truckData.is_at_destination ? 'Unloaded' : 'In Transit'}
            </span>
          </p>
        </div>
        <div>
          <p><strong>Departure:</strong> Lat: {truckData.departure.latitude.toFixed(6)}, Lon: {truckData.departure.longitude.toFixed(6)}</p>
          <p><strong>Destination:</strong> Lat: {truckData.destination.latitude.toFixed(6)}, Lon: {truckData.destination.longitude.toFixed(6)}</p>
          <p><strong>Current GPS:</strong> Lat: {truckData.gps.latitude.toFixed(6)}, Lon: {truckData.gps.longitude.toFixed(6)}</p>
        </div>
      </div>
    </div>
  );
};

export default TruckInfo;