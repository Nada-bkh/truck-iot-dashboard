import json
import time
import random
import os
import math
import threading
import requests
from confluent_kafka import Producer
import websocket

conf = {
    'bootstrap.servers': os.getenv('KAFKA_BROKERS', 'kafka:9092'),
    'client.id': 'truck-iot-producer',
    'retries': 5,
    'retry.backoff.ms': 1000
}
producer = Producer(conf)

# Initialize trucks with proper starting positions
trucks = [
    {
        'truck_id': 'truck_001',
        'plate': 'TUN-1234',
        'driver': 'Ahmed Ben Ali',
        'state': 'En Route',
        'route': [],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'segment': 0,
        'progress': 0.0,
        'destination_name': 'Sfax'
    },
    {
        'truck_id': 'truck_002',
        'plate': 'TUN-5678',
        'driver': 'Fatma Cherif',
        'state': 'En Route',
        'route': [],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'segment': 0,
        'progress': 0.0,
        'destination_name': 'Sousse'
    },
    {
        'truck_id': 'truck_003',
        'plate': 'TUN-9012',
        'driver': 'Mohamed Trabelsi',
        'state': 'En Route',
        'route': [],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'segment': 0,
        'progress': 0.0,
        'destination_name': 'Kairouan'
    },
]

# Tunis → destination cities with names
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

def initialize_truck_route(truck, route_config):
    """Initialize truck route if not already set"""
    if not truck['route']:
        origin = route_config['origin']
        destination = route_config['destination']
        truck['route'] = fetch_osrm_route(origin, destination)
        truck['segment'] = 0
        truck['progress'] = 0.0
        truck['destination_name'] = route_config['destination_name']
        print(f'Initialized route for {truck["truck_id"]} from {route_config["origin_name"]} to {route_config["destination_name"]}')

def simulate_truck_data(truck, truck_index):
    """Simulate truck data with proper GPS coordinates"""
    route_config = initial_coords[truck_index % len(initial_coords)]
    
    # Initialize route if needed
    initialize_truck_route(truck, route_config)
    
    if len(truck['route']) < 2:
        print(f'⚠️  Skipping {truck["truck_id"]}: insufficient route data')
        return None

    # Update truck state based on progress
    if truck['segment'] >= len(truck['route']) - 1 and truck['progress'] >= 0.99:
        truck['state'] = 'At Destination'
        truck['loaded'] = False
        truck['weight'] = 0
    elif truck['progress'] > 0:
        truck['state'] = 'En Route'
    else:
        truck['state'] = 'Idle'

    # Get current position
    current_segment = min(truck['segment'], len(truck['route']) - 2)
    start = truck['route'][current_segment]
    end = truck['route'][current_segment + 1] if current_segment + 1 < len(truck['route']) else truck['route'][-1]
    
    gps = get_interpolated_position(start, end, truck['progress'])
    
    # Ensure GPS coordinates are valid
    if not (-90 <= gps['latitude'] <= 90) or not (-180 <= gps['longitude'] <= 180):
        print(f'⚠️  Invalid GPS coordinates for {truck["truck_id"]}: {gps}')
        gps = {'latitude': 36.8000, 'longitude': 10.1800, 'bearing': 0}  # Default to Tunis

    is_at_destination = truck['segment'] >= len(truck['route']) - 1 and truck['progress'] >= 0.99

    # Create truck data payload
    truck_data = {
        'truck_id': truck['truck_id'],
        'truckId': truck['truck_id'],  # Alternative field name for React
        'id': truck['truck_id'],       # Alternative field name for React
        'plate': truck['plate'],
        'driver': truck['driver'],
        'state': truck['state'],
        'status': truck['state'],      # Alternative field name for React
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'gps': gps,
        'lat': gps['latitude'],
        'lng': gps['longitude'],
        'position': [gps['latitude'], gps['longitude']],
        'coordinates': [gps['latitude'], gps['longitude']],
        'bearing': gps.get('bearing', 0),
        'weight': round(truck['weight'], 2),
        'direction': gps.get('bearing', 0),
        'departure_latitude': truck['route'][0]['latitude'],
        'departure_longitude': truck['route'][0]['longitude'],
        'destination_latitude': truck['route'][-1]['latitude'],
        'destination_longitude': truck['route'][-1]['longitude'],
        'destination': truck.get('destination_name', 'Unknown'),
        'is_at_destination': is_at_destination,
        'speed': random.uniform(40, 80) if truck['state'] == 'En Route' else 0,
        'fuel_level': random.uniform(20, 100),
        'engine_temp': random.uniform(80, 95),
        'route_progress': ((truck['segment'] + truck['progress']) / len(truck['route'])) * 100,
        'route': truck['route'],  # Include full route for visualization
        'current_segment': current_segment
    }
    
    return truck_data

def produce_truck_data():
    """Main producer loop"""
    topic = 'truck-data'
    interval = 2.0  # Increased interval for better visibility
    step_size = 0.01  # Smaller steps for smoother movement
    print(f'🚛 Producing truck data to topic: {topic} (every {interval}s)')

    while True:
        for truck_index, truck in enumerate(trucks):
            try:
                data = simulate_truck_data(truck, truck_index)

                if data:
                    # Send to Kafka
                    producer.produce(topic, json.dumps(data).encode('utf-8'), callback=delivery_report)
                    producer.flush()

                    print(f'📡 Sent: {data["truck_id"]} → {data["state"]} → [{data["lat"]:.5f}, {data["lng"]:.5f}] (Progress: {data["route_progress"]:.1f}%)')

                    # Update truck progress
                    if truck['state'] == 'En Route':
                        truck['progress'] += step_size
                        if truck['progress'] >= 1.0:
                            truck['progress'] = 0.0
                            truck['segment'] += 1

                    # Reset truck for new route when completed
                    if truck['segment'] >= len(truck['route']) - 1 and truck['progress'] >= 0.99 and not truck['loaded']:
                        print(f'🔄 {truck["truck_id"]} starting new delivery route')
                        route_config = initial_coords[truck_index % len(initial_coords)]
                        truck['route'] = fetch_osrm_route(route_config['origin'], route_config['destination'])
                        truck['segment'] = 0
                        truck['progress'] = 0.0
                        truck['weight'] = random.uniform(5000, 20000)
                        truck['loaded'] = True
                        truck['state'] = 'En Route'

            except Exception as e:
                print(f'❌ Error for {truck.get("truck_id", "unknown")}: {e}')
                import traceback
                traceback.print_exc()

        time.sleep(interval)

if __name__ == '__main__':
    print('🚀 Starting Enhanced Truck Simulation...')
    print('📍 Routes configured:')
    for i, config in enumerate(initial_coords):
        print(f'  Truck {i+1}: {config["origin_name"]} → {config["destination_name"]}')
    
    try:
        produce_truck_data()
    except KeyboardInterrupt:
        print('\n🛑 Stopping...')
        producer.flush()