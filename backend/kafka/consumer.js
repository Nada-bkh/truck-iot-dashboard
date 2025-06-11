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

        io.emit('truckData', data);

        const truckData = {
          id: data.truck_id,
          truckId: data.truck_id,
          position: [data.latitude, data.longitude],
          lat: data.latitude,
          lng: data.longitude,
          speed: data.speed,
          weight: data.weight,
          bearing: data.bearing,
          status: data.status,
          driver: data.driver,
          lastUpdate: new Date().toISOString(),
        };

        io.emit('truckUpdate', truckData);
      },
    });
  } catch (error) {
    console.error('Kafka consumer error:', error);
  }
};

module.exports = { runConsumer };
