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

        // Enhanced OSRM request with alternative routes
        const osrmUrl = `http://osrm:5000/route/v1/truck/${departure.longitude},${departure.latitude};${destination.longitude},${destination.latitude}?geometries=geojson&overview=full&steps=true&alternatives=true&alternatives_number=3`;
        console.log(`🚀 Requesting OSRM routes with alternatives: ${osrmUrl}`);

        const response = await axios.get(osrmUrl, {
          timeout: 15000,
          headers: { 'Accept': 'application/json' },
        });

        if (!response.data.routes || response.data.routes.length === 0) {
          throw new Error('No valid routes found from OSRM');
        }

        // Process all routes (main + alternatives)
        const processedRoutes = response.data.routes.map((route_data, index) => {
          const waypoints = route_data.geometry.coordinates.map(([lon, lat]) => ({
            latitude: lat,
            longitude: lon,
          }));

          // Calculate route characteristics
          const distanceKm = route_data.distance / 1000;
          const durationMinutes = route_data.duration / 60;
          const avgSpeedKmh = (distanceKm / (durationMinutes / 60)) || 50; // fallback speed

          // Determine route type
          let routeType, routeDescription;
          if (index === 0) {
            routeType = 'fastest';
            routeDescription = 'Fastest Route';
          } else if (distanceKm < response.data.routes[0].distance / 1000) {
            routeType = 'shortest';
            routeDescription = 'Shortest Route';
          } else {
            routeType = 'alternative';
            routeDescription = `Alternative Route ${index}`;
          }

          return {
            id: `route_${index}`,
            type: routeType,
            description: routeDescription,
            waypoints,
            distance: route_data.distance,
            duration: route_data.duration,
            distanceKm: Math.round(distanceKm * 10) / 10,
            durationMinutes: Math.round(durationMinutes),
            avgSpeedKmh: Math.round(avgSpeedKmh),
            isMain: index === 0,
            geometry: route_data.geometry
          };
        });

        console.log(`✅ OSRM returned ${processedRoutes.length} routes:`);
        processedRoutes.forEach((route, i) => {
          console.log(`   Route ${i + 1} (${route.type}): ${route.distanceKm} km, ${route.durationMinutes} min`);
        });

        // Enhanced route update message for Python simulation (use main route)
        const mainRoute = processedRoutes[0];
        const routeUpdateMessage = {
          truck_id,
          route: mainRoute.waypoints,
          destination_name: `Custom Destination (${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)})`,
          timestamp: new Date().toISOString(),
          distance: mainRoute.distance,
          duration: mainRoute.duration,
          departure: {
            latitude: departure.latitude,
            longitude: departure.longitude
          },
          destination: {
            latitude: destination.latitude,
            longitude: destination.longitude
          },
          alternatives: processedRoutes.slice(1) // Send alternatives for reference
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

        // Enhanced frontend route update with all routes and ETA calculation
        const frontendRouteUpdate = {
          truck_id,
          routes: processedRoutes,
          mainRoute: mainRoute,
          destination_name: routeUpdateMessage.destination_name,
          timestamp: routeUpdateMessage.timestamp,
          totalAlternatives: processedRoutes.length - 1
        };

        io.emit('truckMultiRouteUpdate', frontendRouteUpdate);
        console.log(`📱 Multi-route update sent to frontend for ${truck_id}`);

        // Send success response to requesting client
        socket.emit('routeSetSuccess', {
          truck_id,
          message: `${processedRoutes.length} routes calculated for ${truck_id}`,
          mainRoute: {
            waypoints: mainRoute.waypoints.length,
            distance: mainRoute.distanceKm,
            duration: mainRoute.durationMinutes
          },
          alternatives: processedRoutes.length - 1
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