import React from 'react';

const TruckList = ({ trucks, selectedTruckId, onSelectTruck }) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-4">Available Trucks</h3>
      <ul className="space-y-2">
        {trucks.map((truck) => (
          <li
            key={truck.truck_id}
            className={`p-3 rounded-lg cursor-pointer ${
              truck.truck_id === selectedTruckId
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            onClick={() => onSelectTruck(truck.truck_id)}
          >
            <div className="flex justify-between">
              <span className="font-medium">{truck.plate}</span>
              <span
                className={`text-sm ${
                  truck.state === 'At Destination' ? 'text-green-400' : 'text-yellow-400'
                }`}
              >
                {truck.state}
              </span>
            </div>
            <div className="text-sm">{truck.driver}</div>
          </li>
        ))}
        {trucks.length === 0 && (
          <li className="text-gray-400 text-center">No trucks available</li>
        )}
      </ul>
    </div>
  );
};

export default TruckList;