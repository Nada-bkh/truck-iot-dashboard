import React from 'react';

const ShipmentList = ({ trucks, onSelect }) => (
    <div className="bg-white p-4 shadow-md h-full overflow-y-auto rounded-lg">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Ongoing Deliveries</h2>
        {trucks.map((truck) => (
            <div
                key={truck.truck_id}
                className="mb-4 p-3 border rounded hover:bg-gray-100 cursor-pointer"
                onClick={() => onSelect(truck.truck_id)}
            >
                <p className="font-semibold text-purple-700">Shipment: {truck.truck_id}</p>
                <p className="text-sm text-gray-600">
                    From: {truck.departure?.latitude.toFixed(2)}, {truck.departure?.longitude.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">
                    To: {truck.destination?.latitude.toFixed(2)}, {truck.destination?.longitude.toFixed(2)}
                </p>
                <p className="text-sm text-gray-500">Client: [Placeholder]</p>
            </div>
        ))}
    </div>
);

export default ShipmentList;
