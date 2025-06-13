import json
import time
import random
import os
import math
import threading
import requests
from confluent_kafka import Producer, Consumer, KafkaError
import websocket

conf = {
    'bootstrap.servers': os.getenv('KAFKA_BROKERS', 'kafka:9092'),
    'client.id': 'truck-iot-producer',
    'retries': 5,
    'retry.backoff.ms': 1000
}
producer = Producer(conf)

# Consumer configuration for route updates
consumer_conf = {
    'bootstrap.servers': os.getenv('KAFKA_BROKERS', 'kafka:9092'),
    'group.id': 'truck-route-consumer',
    'auto.offset.reset': 'latest'
}
route_consumer = Consumer(consumer_conf)

# Initialize trucks with proper starting positions
trucks = [
    {
        'truck_id': 'truck_001',
        'plate': 'TUN-1234',
        'driver': 'Ahmed Ben Ali',
        'state': 'Idle',
        'route': [],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'segment': 0,
        'progress': 0.0,
        'destination_name': 'Sfax',
        'current_position': {'latitude': 36.8000, 'longitude': 10.1800}  # Start at Tunis
    },
    {
        'truck_id': 'truck_002',
        'plate': 'TUN-5678',
        'driver': 'Fatma Cherif',
        'state': 'Idle',
        'route': [],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'segment': 0,
        'progress': 0.0,
        'destination_name': 'Sousse',
        'current_position': {'latitude': 36.8000, 'longitude': 10.1800}  # Start at Tunis
    },
    {
        'truck_id': 'truck_003',
        'plate': 'TUN-9012',
        'driver': 'Mohamed Trabelsi',
        'state': 'Idle',
        'route': [],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'segment': 0,
        'progress': 0.0,
        'destination_name': 'Kairouan',
        'current_position': {'latitude': 36.8000, 'longitude': 10.1800}  # Start at Tunis
    },
]

# Tunis → destination cities with names (fallback routes)
initial_coords = [
    {
        'origin': (36.8000, 10.1800),  # Tunis
        'destination': (34.7406, 10.7603),  # Sfax
        'origin_name': 'Tunis',
        'destination_name': 'Sfax'
    },
    {
        'origin': (36.8000, 10.1800),  # Tunis
        'destination': (35.8256, 10.6411),  # Sousse
        'origin_name': 'Tunis',
        'destination_name': 'Sousse'
    },
    {
        'origin': (36.8000, 10.1800),  # Tunis
        'destination': (35.6781, 10.0963),  # Kairouan
        'origin_name': 'Tunis',
        'destination_name': 'Kairouan'
    },
]

def delivery_report(err, msg):
    if err:
        print(f'Message delivery failed: {err}')
    else:
        print(f'Message delivered to {msg.topic()} [{msg.partition()}]')

def calculate_bearing(start, end):
    """Calculate bearing between two GPS coordinates"""
    lat1, lon1 = math.radians(start['latitude']), math.radians(start['longitude'])
    lat2, lon2 = math.radians(end['latitude']), math.radians(end['longitude'])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360

def calculate_distance(start, end):
    """Calculate distance between two GPS coordinates in meters"""
    lat1, lon1 = math.radians(start['latitude']), math.radians(start['longitude'])
    lat2, lon2 = math.radians(end['latitude']), math.radians(end['longitude'])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371000  # Radius of earth in meters
    
    return c * r

def get_interpolated_position(start, end, progress):
    """Get interpolated position between two points"""
    lat = start['latitude'] + (end['latitude'] - start['latitude']) * progress
    lon = start['longitude'] + (end['longitude'] - start['longitude']) * progress
    bearing = calculate_bearing(start, end)
    return {'latitude': lat, 'longitude': lon, 'bearing': bearing}

def fetch_osrm_route(origin, destination):
    """Fetch route from OSRM with fallback to direct route"""
    host = os.getenv('OSRM_HOST', 'osrm')
    port = os.getenv('OSRM_PORT', '5000')
    profile = os.getenv('OSRM_PROFILE', 'truck')
    url = f"http://{host}:{port}/route/v1/{profile}/{origin[1]},{origin[0]};{destination[1]},{destination[0]}?overview=full&geometries=geojson"
    
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        coords = data['routes'][0]['geometry']['coordinates']
        route = [{'latitude': lat, 'longitude': lon} for lon, lat in coords]
        print(f'✅ OSRM route fetched from {origin} to {destination} with {len(route)} points.')
        return route
    except Exception as e:
        print(f'❌ Failed to fetch OSRM route: {e}')
        # Fallback: create a simple route with intermediate points
        fallback_route = create_fallback_route(origin, destination)
        print(f'📍 Using fallback route with {len(fallback_route)} points')
        return fallback_route

def create_fallback_route(origin, destination, num_points=10):
    """Create a fallback route with intermediate points"""
    route = []
    for i in range(num_points + 1):
        progress = i / num_points
        lat = origin[0] + (destination[0] - origin[0]) * progress
        lon = origin[1] + (destination[1] - origin[1]) * progress
        route.append({'latitude': lat, 'longitude': lon})
    return route

def update_truck_route(truck_id, new_route, destination_name=None):
    """Update a truck's route with new waypoints"""
    truck = next((t for t in trucks if t['truck_id'] == truck_id), None)
    if not truck:
        print(f'⚠️  Truck {truck_id} not found for route update')
        return
    
    print(f'🗺️  Updating route for {truck_id} with {len(new_route)} waypoints')
    
    # Update the truck's route starting from its current position
    truck['route'] = new_route
    truck['segment'] = 0
    truck['progress'] = 0.0
    truck['state'] = 'En Route'
    truck['destination_name'] = destination_name or 'Custom Destination'
    
    # Update current position to the first point of the new route
    if new_route:
        truck['current_position'] = {
            'latitude': new_route[0]['latitude'],
            'longitude': new_route[0]['longitude']
        }
    
    print(f'✅ Route updated for {truck_id} - State: {truck["state"]}')

def listen_for_route_updates():
    """Listen for route updates from Kafka"""
    try:
        print('🎧 Starting route update listener...')
        route_consumer.subscribe(['truck-route-updates'])
        
        while True:
            msg = route_consumer.poll(timeout=1.0)
            if msg is None:
                continue
                
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    print(f'❌ Route consumer error: {msg.error()}')
                    break
            
            try:
                route_data = json.loads(msg.value().decode('utf-8'))
                print(f'📨 Received route update: {route_data}')
                
                truck_id = route_data.get('truck_id')
                route = route_data.get('route', [])
                destination_name = route_data.get('destination_name')
                
                if truck_id and route:
                    update_truck_route(truck_id, route, destination_name)
                
            except json.JSONDecodeError as e:
                print(f'❌ Failed to decode route update message: {e}')
                
    except Exception as e:
        print(f'❌ Route listener error: {e}')
    finally:
        route_consumer.close()

def initialize_truck_route(truck, route_config):
    """Initialize truck route if not already set"""
    if not truck['route']:
        origin = route_config['origin']
        destination = route_config['destination']
        truck['route'] = fetch_osrm_route(origin, destination)
        truck['segment'] = 0
        truck['progress'] = 0.0
        truck['destination_name'] = route_config['destination_name']
        truck['state'] = 'En Route'
        print(f'Initialized route for {truck["truck_id"]} from {route_config["origin_name"]} to {route_config["destination_name"]}')

def simulate_truck_data(truck, truck_index):
    """Simulate truck data with proper GPS coordinates"""
    route_config = initial_coords[truck_index % len(initial_coords)]
    
    # Initialize route if needed and truck is idle
    if not truck['route'] and truck['state'] == 'Idle':
        initialize_truck_route(truck, route_config)
    
    if len(truck['route']) < 2:
        # If no route, truck stays at current position
        gps = truck['current_position']
        truck['state'] = 'Idle'
        speed = 0
    else:
        # Update truck state based on progress
        if truck['segment'] >= len(truck['route']) - 1 and truck['progress'] >= 0.99:
            truck['state'] = 'At Destination'
            truck['loaded'] = False
            truck['weight'] = random.uniform(0, 1000)  # Mostly unloaded
            speed = 0
        elif truck['progress'] > 0:
            truck['state'] = 'En Route'
            speed = random.uniform(40, 80)
        else:
            truck['state'] = 'Idle'
            speed = 0

        # Get current position
        current_segment = min(truck['segment'], len(truck['route']) - 2)
        start = truck['route'][current_segment]
        end = truck['route'][current_segment + 1] if current_segment + 1 < len(truck['route']) else truck['route'][-1]
        
        gps = get_interpolated_position(start, end, truck['progress'])
        
        # Update truck's current position
        truck['current_position'] = {
            'latitude': gps['latitude'],
            'longitude': gps['longitude']
        }

    # Ensure GPS coordinates are valid
    if not (-90 <= gps['latitude'] <= 90) or not (-180 <= gps['longitude'] <= 180):
        print(f'⚠️  Invalid GPS coordinates for {truck["truck_id"]}: {gps}')
        gps = truck['current_position']  # Use last known good position

    is_at_destination = truck['segment'] >= len(truck['route']) - 1 and truck['progress'] >= 0.99

    # Create truck data payload
    truck_data = {
        'truck_id': truck['truck_id'],
        'truckId': truck['truck_id'],
        'id': truck['truck_id'],
        'plate': truck['plate'],
        'driver': truck['driver'],
        'state': truck['state'],
        'status': truck['state'],
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'gps': gps,
        'lat': gps['latitude'],
        'lng': gps['longitude'],
        'position': [gps['latitude'], gps['longitude']],
        'coordinates': [gps['latitude'], gps['longitude']],
        'bearing': gps.get('bearing', 0),
        'weight': round(truck['weight'], 2),
        'direction': gps.get('bearing', 0),
        'destination': truck.get('destination_name', 'Unknown'),
        'is_at_destination': is_at_destination,
        'speed': speed,
        'fuel_level': random.uniform(20, 100),
        'engine_temp': random.uniform(80, 95),
        'route_progress': ((truck['segment'] + truck['progress']) / max(len(truck['route']), 1)) * 100 if truck['route'] else 0,
        'route': truck['route'],
        'current_segment': truck['segment'] if truck['route'] else 0
    }
    
    # Add route endpoints if route exists
    if truck['route']:
        truck_data['departure_latitude'] = truck['route'][0]['latitude']
        truck_data['departure_longitude'] = truck['route'][0]['longitude']
        truck_data['destination_latitude'] = truck['route'][-1]['latitude']
        truck_data['destination_longitude'] = truck['route'][-1]['longitude']
    
    return truck_data

def produce_truck_data():
    """Main producer loop"""
    topic = 'truck-data'
    interval = 2.0
    step_size = 0.02  # Adjust for movement speed
    print(f'🚛 Producing truck data to topic: {topic} (every {interval}s)')

    while True:
        for truck_index, truck in enumerate(trucks):
            try:
                data = simulate_truck_data(truck, truck_index)

                if data:
                    # Send to Kafka
                    producer.produce(topic, json.dumps(data).encode('utf-8'), callback=delivery_report)
                    producer.flush()

                    print(f'📡 {data["truck_id"]} → {data["state"]} → [{data["lat"]:.5f}, {data["lng"]:.5f}] (Progress: {data["route_progress"]:.1f}%)')

                    # Update truck progress only if en route
                    if truck['state'] == 'En Route' and truck['route']:
                        truck['progress'] += step_size
                        if truck['progress'] >= 1.0:
                            truck['progress'] = 0.0
                            truck['segment'] += 1

                    # Reset truck for new route when completed
                    if truck['state'] == 'At Destination' and not truck['loaded']:
                        print(f'🔄 {truck["truck_id"]} completed delivery, going idle')
                        truck['state'] = 'Idle'
                        truck['route'] = []
                        truck['segment'] = 0
                        truck['progress'] = 0.0
                        truck['weight'] = random.uniform(5000, 20000)
                        truck['loaded'] = True
                        # Keep truck at destination for pickup
                        time.sleep(5)  # Wait 5 seconds before becoming available

            except Exception as e:
                print(f'❌ Error for {truck.get("truck_id", "unknown")}: {e}')
                import traceback
                traceback.print_exc()

        time.sleep(interval)

if __name__ == '__main__':
    print('🚀 Starting Enhanced Truck Simulation with Route Updates...')
    print('📍 Initial routes configured:')
    for i, config in enumerate(initial_coords):
        print(f'  Truck {i+1}: {config["origin_name"]} → {config["destination_name"]}')
    
    # Start route update listener in a separate thread
    route_thread = threading.Thread(target=listen_for_route_updates, daemon=True)
    route_thread.start()
    
    try:
        produce_truck_data()
    except KeyboardInterrupt:
        print('\n🛑 Stopping...')
        producer.flush()
        route_consumer.close()