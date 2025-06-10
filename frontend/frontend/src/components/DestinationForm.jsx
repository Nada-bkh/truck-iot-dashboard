import React, { useState } from 'react';
import axios from 'axios';

const DestinationForm = ({ onSubmit }) => {
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const depResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: departure,
          format: 'json',
          limit: 1,
          addressdetails: 1,
          extratags: 1,
        },
        headers: { 'User-Agent': 'TruckIoT/1.0' },
      });
      if (!depResponse.data[0] || !depResponse.data[0].address.road) {
        throw new Error('Departure must be a valid street address');
      }

      const destResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: destination,
          format: 'json',
          limit: 1,
          addressdetails: 1,
          extratags: 1,
        },
        headers: { 'User-Agent': 'TruckIoT/1.0' },
      });
      if (!destResponse.data[0] || !destResponse.data[0].address.road) {
        throw new Error('Destination must be a valid street address');
      }

      const depCoords = {
        latitude: parseFloat(depResponse.data[0].lat),
        longitude: parseFloat(depResponse.data[0].lon),
      };
      const destCoords = {
        latitude: parseFloat(destResponse.data[0].lat),
        longitude: parseFloat(destResponse.data[0].lon),
      };

      onSubmit({ departure: depCoords, destination: destCoords });
      setDeparture('');
      setDestination('');
    } catch (err) {
      setError(err.message || 'Error geocoding addresses');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white shadow-md rounded-lg max-w-3xl mx-auto mt-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Set Truck Route</h2>
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Departure (e.g., Avenida Balboa, Panama City)"
          value={departure}
          onChange={(e) => setDeparture(e.target.value)}
          className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={loading}
        />
        <input
          type="text"
          placeholder="Destination (e.g., Calle 50, San José)"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={loading}
        />
        <button
          type="submit"
          className="p-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:bg-gray-400"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Set Route'}
        </button>
      </form>
    </div>
  );
};

export default DestinationForm;