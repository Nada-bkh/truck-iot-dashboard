const { Server } = require('socket.io');
const { runConsumer } = require('../kafka/consumer');
const axios = require('axios');

const initializeWebSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.emit('message', { type: 'connection_established' });

    socket.on('setRoute', async (route) => {
      try {
        const { departure, destination, truck_id } = route;

        if (!departure?.longitude || !departure?.latitude || 
            !destination?.longitude || !destination?.latitude) {
          throw new Error('Invalid route coordinates');
        }

        console.log(`Setting route for truck ${truck_id} from [${departure.latitude}, ${departure.longitude}] to [${destination.latitude}, ${destination.longitude}]`);

        const response = await axios.get(
          `http://osrm:5000/route/v1/truck/${departure.longitude},${departure.latitude};${destination.longitude},${destination.latitude}?geometries=geojson&overview=full&steps=true`,
          {
            timeout: 10000,
            headers: { 'Accept': 'application/json' },
          }
        );

        if (!response.data.routes[0]) {
          throw new Error('No valid route found');
        }

        const waypoints = response.data.routes[0].geometry.coordinates.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        }));

        io.emit('truckRouteUpdate', {
          truck_id,
          route: waypoints,
          distance: response.data.routes[0].distance,
          duration: response.data.routes[0].duration,
        });

        console.log(`Route set for ${truck_id}: ${waypoints.length} waypoints, ${Math.round(response.data.routes[0].distance / 1000)} km`);

      } catch (error) {
        console.error('Error fetching route:', error.message);
        socket.emit('routeError', {
          message: error.message,
          truck_id: route?.truck_id || null,
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  runConsumer(io).catch(console.error);

  return io;
};

module.exports = { initializeWebSocket };
