const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'truck-iot-consumer',
  brokers: [process.env.KAFKA_BROKERS || 'kafka:9092'],
});

const consumer = kafka.consumer({ groupId: 'truck-iot-group' });

const runConsumer = async (io) => {
  try {
    await consumer.connect();
    console.log('Connected to Kafka');
    await consumer.subscribe({ topic: 'truck-data', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const data = JSON.parse(message.value.toString());
        console.log('Received Kafka message:', data);

        // Extract coordinates from the various possible formats
        let latitude = null;
        let longitude = null;

        // Try different coordinate formats from the Python script
        if (data.gps && typeof data.gps.latitude === 'number' && typeof data.gps.longitude === 'number') {
          latitude = data.gps.latitude;
          longitude = data.gps.longitude;
        } else if (typeof data.lat === 'number' && typeof data.lng === 'number') {
          latitude = data.lat;
          longitude = data.lng;
        } else if (data.position && Array.isArray(data.position) && data.position.length === 2) {
          latitude = data.position[0];
          longitude = data.position[1];
        } else if (data.coordinates && Array.isArray(data.coordinates) && data.coordinates.length === 2) {
          latitude = data.coordinates[0];
          longitude = data.coordinates[1];
        }

        // Validate coordinates
        if (latitude === null || longitude === null || 
            typeof latitude !== 'number' || typeof longitude !== 'number' ||
            isNaN(latitude) || isNaN(longitude) ||
            latitude === 0 || longitude === 0) {
          console.warn('Invalid coordinates in message:', data);
          return; // Skip this message
        }

        console.log(`Valid coordinates extracted: [${latitude}, ${longitude}]`);

        // Emit the original data first
        io.emit('truckData', data);

        // Create standardized truck data for the frontend
        const truckData = {
          id: data.truck_id,
          truckId: data.truck_id,
          truck_id: data.truck_id, // Include all possible ID formats
          position: [latitude, longitude],
          lat: latitude,
          lng: longitude,
          coordinates: [latitude, longitude],
          gps: {
            latitude: latitude,
            longitude: longitude
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

        console.log('Emitting standardized truck data:', {
          id: truckData.id,
          position: truckData.position,
          state: truckData.state
        });

        io.emit('truckUpdate', truckData);
      },
    });
  } catch (error) {
    console.error('Kafka consumer error:', error);
  }
};

module.exports = { runConsumer };
