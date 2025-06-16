const { Server } = require('socket.io');
const { runConsumer } = require('../kafka/consumer');
const { Kafka } = require('kafkajs');
const axios = require('axios');

// Kafka producer for sending route updates to simulation
const kafka = new Kafka({
  clientId: 'route-update-producer',
  brokers: [process.env.KAFKA_BROKERS || 'kafka:9092'],
});

const routeProducer = kafka.producer();

const initializeWebSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
    },
  });

  // Initialize Kafka producer
  routeProducer.connect().then(() => {
    console.log('✅ Route update producer connected to Kafka');
  }).catch(console.error);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.emit('message', { type: 'connection_established' });

    socket.on('setRoute', async (route) => {
      try {
        const { departure, destination, truck_id } = route;

        console.log('📍 Received setRoute request:', {
          truck_id,
          departure,
          destination
        });

        if (!departure?.longitude || !departure?.latitude || 
            !destination?.longitude || !destination?.latitude) {
          throw new Error('Invalid route coordinates');
        }

        if (!truck_id) {
          throw new Error('Missing truck_id');
        }

        console.log(`🗺️  Setting route for truck ${truck_id}`);
        console.log(`   From: [${departure.latitude}, ${departure.longitude}]`);
        console.log(`   To: [${destination.latitude}, ${destination.longitude}]`);

        // Get route from OSRM
        const osrmUrl = `http://osrm:5000/route/v1/truck/${departure.longitude},${departure.latitude};${destination.longitude},${destination.latitude}?geometries=geojson&overview=full&steps=true`;
        console.log(`🚀 Requesting OSRM route: ${osrmUrl}`);

        const response = await axios.get(osrmUrl, {
          timeout: 15000,
          headers: { 'Accept': 'application/json' },
        });

        if (!response.data.routes || !response.data.routes[0]) {
          throw new Error('No valid route found from OSRM');
        }

        const route_data = response.data.routes[0];
        const waypoints = route_data.geometry.coordinates.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        }));

        console.log(`✅ OSRM returned route with ${waypoints.length} waypoints`);
        console.log(`   Distance: ${Math.round(route_data.distance / 1000)} km`);
        console.log(`   Duration: ${Math.round(route_data.duration / 60)} minutes`);

        // Create route update message for Python simulation
        const routeUpdateMessage = {
          truck_id,
          route: waypoints,
          destination_name: `Custom Destination (${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)})`,
          timestamp: new Date().toISOString(),
          distance: route_data.distance,
          duration: route_data.duration,
          departure: {
            latitude: departure.latitude,
            longitude: departure.longitude
          },
          destination: {
            latitude: destination.latitude,
            longitude: destination.longitude
          }
        };

        console.log('📨 Sending route update to Python simulation via Kafka...');

        // Send route update to Python simulation via Kafka
        await routeProducer.send({
          topic: 'truck-route-updates',
          messages: [{
            key: truck_id,
            value: JSON.stringify(routeUpdateMessage),
          }],
        });

        console.log(`✅ Route update sent to simulation for ${truck_id}`);

        // Send route update to frontend for immediate display
        const frontendRouteUpdate = {
          truck_id,
          route: waypoints,
          distance: route_data.distance,
          duration: route_data.duration,
          destination_name: routeUpdateMessage.destination_name,
          timestamp: routeUpdateMessage.timestamp
        };

        io.emit('truckRouteUpdate', frontendRouteUpdate);
        console.log(`📱 Route update sent to frontend for ${truck_id}`);

        // Send success response to requesting client
        socket.emit('routeSetSuccess', {
          truck_id,
          message: `Route set successfully for ${truck_id}`,
          waypoints: waypoints.length,
          distance: Math.round(route_data.distance / 1000),
          duration: Math.round(route_data.duration / 60)
        });

      } catch (error) {
        console.error('❌ Error setting route:', error.message);
        console.error('❌ Full error:', error);
        
        socket.emit('routeError', {
          message: error.message,
          truck_id: route?.truck_id || null,
          details: error.response?.data || null
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