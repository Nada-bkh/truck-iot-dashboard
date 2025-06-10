const { Server } = require('socket.io');
const { runConsumer } = require('../kafka/consumer');
const axios = require('axios');

const initializeWebSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173'],
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('setRoute', async (route) => {
      try {
        const { departure, destination, truck_id } = route;
        if (!departure?.longitude || !departure?.latitude || !destination?.longitude || !destination?.latitude) {
          throw new Error('Invalid route coordinates');
        }
        const response = await axios.get(
          `http://osrm:5000/route/v1/truck/${departure.longitude},${departure.latitude};${destination.longitude},${destination.latitude}?geometries=geojson&overview=full&steps=true`,
          {
            timeout: 5000,
            headers: { 'Accept': 'application/json' } // Safe headers only
          }
        );
        if (!response.data.routes[0]) throw new Error('No valid route found');
        const waypoints = response.data.routes[0].geometry.coordinates.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        }));
        io.emit('truckRouteUpdate', { truck_id, route: waypoints });
        console.log('Sent route for', truck_id, 'with', waypoints.length, 'waypoints');
      } catch (e) {
        console.error('Error fetching route:', e.message);
        socket.emit('routeError', { message: e.message });
      }
    });
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
  });

  runConsumer(io).catch(console.error);

  return io;
};

module.exports = { initializeWebSocket };