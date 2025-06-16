const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'truck-iot-consumer',
  brokers: [process.env.KAFKA_BROKERS || 'kafka:9092'],
});

const consumer = kafka.consumer({ groupId: 'truck-iot-group' });

const runConsumer = async (io) => {
  try {
    await consumer.connect();
    console.log('Kafka consumer connected');

    // Subscribe to both topics
    await consumer.subscribe({ topic: 'truck-data', fromBeginning: true });
    await consumer.subscribe({ topic: 'truck-route-updates', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const rawValue = message.value.toString();

        try {
          const data = JSON.parse(rawValue);

          if (topic === 'truck-data') {
            let latitude = null;
            let longitude = null;

            if (data.gps && typeof data.gps.latitude === 'number' && typeof data.gps.longitude === 'number') {
              latitude = data.gps.latitude;
              longitude = data.gps.longitude;
            } else if (typeof data.lat === 'number' && typeof data.lng === 'number') {
              latitude = data.lat;
              longitude = data.lng;
            } else if (data.position?.length === 2) {
              latitude = data.position[0];
              longitude = data.position[1];
            } else if (data.coordinates?.length === 2) {
              latitude = data.coordinates[0];
              longitude = data.coordinates[1];
            }

            if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
              console.warn('Invalid coordinates in message:', data);
              return;
            }

            // Emit raw truck data
            io.emit('truckData', data);

            // Emit normalized truck data
            const truckData = {
              id: data.truck_id,
              truckId: data.truck_id,
              truck_id: data.truck_id,
              position: [latitude, longitude],
              lat: latitude,
              lng: longitude,
              coordinates: [latitude, longitude],
              gps: {
                latitude,
                longitude
              },
              speed: data.speed || 0,
              weight: data.weight || 0,
              bearing: data.bearing || data.direction || 0,
              direction: data.bearing || data.direction || 0,
              status: data.status || data.state || 'Unknown',
              state: data.state || data.status || 'Unknown',
              driver: data.driver || 'Unknown',
              plate: data.plate || 'Unknown',
              destination: data.destination || 'Unknown',
              route: data.route || [],
              route_progress: data.route_progress || 0,
              fuel_level: data.fuel_level || 0,
              engine_temp: data.engine_temp || 0,
              is_at_destination: data.is_at_destination || false,
              lastUpdate: new Date().toISOString(),
              timestamp: data.timestamp || new Date().toISOString()
            };

            io.emit('truckUpdate', truckData);
            console.log(`📍 truckUpdate for ${truckData.truck_id} at [${latitude.toFixed(4)}, ${longitude.toFixed(4)}] - ${truckData.state}`);

          } else if (topic === 'truck-route-updates') {
            console.log('📨 Route update received from simulation:', data);

            // Forward route update to frontend
            io.emit('truckRouteUpdate', {
              truck_id: data.truck_id,
              route: data.route,
              distance: data.distance,
              duration: data.duration,
              destination_name: data.destination_name,
              timestamp: data.timestamp
            });

            console.log(`✅ Forwarded route update for truck ${data.truck_id}`);
          }
        } catch (error) {
          console.error(`Error parsing Kafka message from topic ${topic}:`, error.message);
        }
      },
    });
  } catch (error) {
    console.error('Kafka consumer error:', error);
  }
};

module.exports = { runConsumer };