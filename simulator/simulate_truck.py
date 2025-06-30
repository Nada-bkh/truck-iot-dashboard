import json
import time
import random
import os
import math
import threading
import requests
from confluent_kafka import Producer, Consumer, KafkaError

conf = {
    'bootstrap.servers': os.getenv('KAFKA_BROKERS', 'kafka:9092'),
    'client.id': 'truck-iot-producer',
    'retries': 5,
    'retry.backoff.ms': 1000
}
producer = Producer(conf)

consumer_conf = {
    'bootstrap.servers': os.getenv('KAFKA_BROKERS', 'kafka:9092'),
    'group.id': 'truck-route-consumer',
    'auto.offset.reset': 'latest'
}
route_consumer = Consumer(consumer_conf)

trucks = [
    {
        'truck_id': 'truck_001',
        'plate': 'TUN-1234',
        'driver': 'Ahmed Ben Ali',
        'state': 'Idle',
        'route': [],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'current_waypoint_index': 0,
        'progress_on_segment': 0.0,
        'destination_name': 'Waiting for assignment',
        'current_position': {'latitude': 36.8000, 'longitude': 10.1800},
        'base_speed': random.uniform(45, 65)
    },
    {
        'truck_id': 'truck_002',
        'plate': 'TUN-5678',
        'driver': 'Fatma Cherif',
        'state': 'Idle',
        'route': [],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'current_waypoint_index': 0,
        'progress_on_segment': 0.0,
        'destination_name': 'Waiting for assignment',
        'current_position': {'latitude': 36.7500, 'longitude': 10.1500},
        'base_speed': random.uniform(45, 65)
    },
    {
        'truck_id': 'truck_003',
        'plate': 'TUN-9012',
        'driver': 'Mohamed Trabelsi',
        'state': 'Idle',
        'route': [],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'current_waypoint_index': 0,
        'progress_on_segment': 0.0,
        'destination_name': 'Waiting for assignment',
        'current_position': {'latitude': 36.8200, 'longitude': 10.2000},
        'base_speed': random.uniform(45, 65)
    },
]

def delivery_report(err, msg):
    if err:
        print(f'Message delivery failed: {err}')

def calculate_distance(point1, point2):
    """Calculate distance between two GPS coordinates in kilometers using Haversine formula"""
    lat1, lon1 = math.radians(point1['latitude']), math.radians(point1['longitude'])
    lat2, lon2 = math.radians(point2['latitude']), math.radians(point2['longitude'])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    r = 6371
    return c * r

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

def create_route_from_current_position(truck, new_route):
    """Create a route starting from truck's current position to the new destination"""
    if not new_route:
        return []
    
    current_pos = truck['current_position']
    destination = new_route[-1]
    
    print(f'🗺️  Creating route from current position [{current_pos["latitude"]:.4f}, {current_pos["longitude"]:.4f}] to destination [{destination["latitude"]:.4f}, {destination["longitude"]:.4f}]')
    
    first_point = new_route[0]
    distance_to_start = calculate_distance(current_pos, first_point)
    
    if distance_to_start < 0.1:
        print(f'✅ Using provided route as-is (starts near current position)')
        return new_route
    
    try:
        host = os.getenv('OSRM_HOST', 'osrm')
        port = os.getenv('OSRM_PORT', '5000')
        profile = os.getenv('OSRM_PROFILE', 'truck')
        url = f"http://{host}:{port}/route/v1/{profile}/{current_pos['longitude']},{current_pos['latitude']};{destination['longitude']},{destination['latitude']}?overview=full&geometries=geojson"
        
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data['routes']:
            coords = data['routes'][0]['geometry']['coordinates']
            route_from_current = [{'latitude': lat, 'longitude': lon} for lon, lat in coords]
            print(f'✅ Created OSRM route from current position with {len(route_from_current)} waypoints')
            return route_from_current
        else:
            raise Exception("No route found")
            
    except Exception as e:
        print(f'❌ Failed to get OSRM route from current position: {e}')
        print(f'📍 Using fallback direct route')
        return [
            current_pos,
            destination
        ]

def update_truck_route(truck_id, new_route, destination_name=None):
    """Update a truck's route with new waypoints, starting from current position"""
    truck = next((t for t in trucks if t['truck_id'] == truck_id), None)
    if not truck:
        print(f'⚠️  Truck {truck_id} not found for route update')
        return
    
    print(f'🚛 Updating route for {truck_id}')
    print(f'📍 Current position: [{truck["current_position"]["latitude"]:.4f}, {truck["current_position"]["longitude"]:.4f}]')
    print(f'📍 Current state: {truck["state"]}')
    
    if not new_route:
        print(f'⚠️  Empty route provided for {truck_id}')
        return
    
    optimized_route = create_route_from_current_position(truck, new_route)
    
    truck['route'] = optimized_route
    truck['current_waypoint_index'] = 0
    truck['progress_on_segment'] = 0.0
    truck['state'] = 'En Route'
    truck['destination_name'] = destination_name or 'Custom Destination'
    
    print(f'✅ Route updated for {truck_id}')
    print(f'   - Waypoints: {len(truck["route"])}')
    print(f'   - State: {truck["state"]}')
    print(f'   - Destination: {truck["destination_name"]}')
    if truck['route']:
        dest = truck['route'][-1]
        print(f'   - Final destination: [{dest["latitude"]:.4f}, {dest["longitude"]:.4f}]')

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
                print(f'📨 Received route update from frontend:')
                print(f'   - Truck: {route_data.get("truck_id")}')
                print(f'   - Destination: {route_data.get("destination_name", "Unknown")}')
                print(f'   - Waypoints: {len(route_data.get("route", []))}')
                
                truck_id = route_data.get('truck_id')
                route = route_data.get('route', [])
                destination_name = route_data.get('destination_name')
                
                if truck_id and route:
                    update_truck_route(truck_id, route, destination_name)
                else:
                    print(f'⚠️  Invalid route update data: missing truck_id or route')
                
            except json.JSONDecodeError as e:
                print(f'❌ Failed to decode route update message: {e}')
                
    except Exception as e:
        print(f'❌ Route listener error: {e}')
        import traceback
        traceback.print_exc()
    finally:
        route_consumer.close()

def simulate_truck_movement(truck, time_interval=2.0):
    """Simulate truck movement along the route with realistic speed"""
    if not truck['route'] or len(truck['route']) < 2:
        return truck['current_position'], 0, False
    
    base_speed = truck['base_speed']
    speed_variation = random.uniform(-5, 5)
    current_speed_kmh = max(20, min(80, base_speed + speed_variation))
    
    current_waypoint_idx = truck['current_waypoint_index']
    progress = truck['progress_on_segment']
    
    if current_waypoint_idx >= len(truck['route']) - 1:
        truck['progress_on_segment'] = 1.0
        return truck['route'][-1], calculate_bearing(truck['route'][-2], truck['route'][-1]), True
    
    start_point = truck['route'][current_waypoint_idx]
    end_point = truck['route'][current_waypoint_idx + 1]
    
    segment_distance_km = calculate_distance(start_point, end_point)
    
    if segment_distance_km < 0.001:
        truck['current_waypoint_index'] += 1
        truck['progress_on_segment'] = 0.0
        return simulate_truck_movement(truck, time_interval)
    
    # Distance = speed * time (convert time_interval from seconds to hours)
    distance_to_move_km = current_speed_kmh * (time_interval / 3600.0)
    
    progress_increment = distance_to_move_km / segment_distance_km if segment_distance_km > 0 else 1.0
    
    new_progress = progress + progress_increment
    
    if new_progress >= 1.0:
        truck['current_waypoint_index'] += 1
        truck['progress_on_segment'] = 0.0
        
        if truck['current_waypoint_index'] >= len(truck['route']) - 1:
            return truck['route'][-1], calculate_bearing(start_point, end_point), True
        
        remaining_distance = (new_progress - 1.0) * segment_distance_km
        if remaining_distance > 0.001:
            return simulate_truck_movement(truck, time_interval)
        else:
            return simulate_truck_movement(truck, time_interval)
    else:
        truck['progress_on_segment'] = new_progress
        
        current_position = get_interpolated_position(start_point, end_point, new_progress)
        bearing = current_position.get('bearing', 0)
        
        return current_position, bearing, False

def simulate_truck_data(truck):
    """Simulate truck data - trucks only move when they have a route assigned"""
    
    if not truck['route'] or len(truck['route']) < 2:
        gps = truck['current_position']
        truck['state'] = 'Idle'
        speed = 0
        bearing = 0
        is_at_destination = False
    else:
        time_interval = 2.0
        
        new_position, bearing, reached_destination = simulate_truck_movement(truck, time_interval)
        
        truck['current_position'] = {
            'latitude': new_position['latitude'],
            'longitude': new_position['longitude']
        }
        
        gps = truck['current_position']
        
        if reached_destination:
            truck['state'] = 'At Destination'
            truck['loaded'] = False
            truck['weight'] = random.uniform(0, 1000)
            speed = 0
            is_at_destination = True
        else:
            truck['state'] = 'En Route'
            speed = truck['base_speed'] + random.uniform(-5, 5)
            speed = max(20, min(80, speed))
            is_at_destination = False

    if not (-90 <= gps['latitude'] <= 90) or not (-180 <= gps['longitude'] <= 180):
        print(f'⚠️  Invalid GPS coordinates for {truck["truck_id"]}: {gps}')
        gps = truck['current_position']

    if truck['route'] and len(truck['route']) > 1:
        total_waypoints = len(truck['route']) - 1
        current_waypoint = truck['current_waypoint_index']
        progress_on_segment = truck['progress_on_segment']
        
        if current_waypoint >= total_waypoints:
            route_progress = 100.0
        else:
            route_progress = ((current_waypoint + progress_on_segment) / total_waypoints) * 100
    else:
        route_progress = 0.0

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
        'bearing': bearing,
        'weight': round(truck['weight'], 2),
        'direction': bearing,
        'destination': truck.get('destination_name', 'Waiting for assignment'),
        'is_at_destination': is_at_destination,
        'speed': speed,
        'fuel_level': random.uniform(20, 100),
        'engine_temp': random.uniform(80, 95),
        'route_progress': route_progress,
        'route': truck['route'],
        'current_waypoint': truck['current_waypoint_index'] if truck['route'] else 0
    }
    
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
    print(f'🚛 Producing truck data to topic: {topic} (every {interval}s)')
    print(f'📍 All trucks start IDLE - waiting for route assignments from frontend')

    while True:
        for truck in trucks:
            try:
                data = simulate_truck_data(truck)

                if data:
                    producer.produce(topic, json.dumps(data).encode('utf-8'), callback=delivery_report)

                    if truck['state'] == 'Idle':
                        print(f'⏸️  {data["truck_id"]} → {data["state"]} → [{data["lat"]:.5f}, {data["lng"]:.5f}] → {data["destination"]}')
                    elif truck['state'] == 'En Route':
                        print(f'🚛 {data["truck_id"]} → {data["state"]} → [{data["lat"]:.5f}, {data["lng"]:.5f}] (Progress: {data["route_progress"]:.1f}%) Speed: {data["speed"]:.1f} km/h Waypoint: {truck["current_waypoint_index"]}/{len(truck["route"])-1}')
                    elif truck['state'] == 'At Destination':
                        print(f'🎯 {data["truck_id"]} → {data["state"]} → [{data["lat"]:.5f}, {data["lng"]:.5f}] → {data["destination"]}')

                    # Reset truck when delivery is completed
                    if truck['state'] == 'At Destination' and not truck['loaded']:
                        print(f'✅ {truck["truck_id"]} completed delivery, going idle')
                        truck['state'] = 'Idle'
                        truck['route'] = []  # Clear route
                        truck['current_waypoint_index'] = 0
                        truck['progress_on_segment'] = 0.0
                        truck['weight'] = random.uniform(5000, 20000)
                        truck['loaded'] = True
                        truck['destination_name'] = 'Waiting for assignment'
                        # Truck stays at current position (delivery location)
                        print(f'📍 {truck["truck_id"]} now idle at [{truck["current_position"]["latitude"]:.4f}, {truck["current_position"]["longitude"]:.4f}]')

            except Exception as e:
                print(f'❌ Error for {truck.get("truck_id", "unknown")}: {e}')
                import traceback
                traceback.print_exc()

        # Flush producer every iteration
        producer.flush()
        time.sleep(interval)

if __name__ == '__main__':
    print('🚀 Starting Truck Simulation - IDLE MODE')
    print('📍 All trucks start IDLE and will only move when routes are assigned from frontend')
    print('🎯 Trucks available:')
    for truck in trucks:
        print(f'   - {truck["truck_id"]} ({truck["plate"]}) - Driver: {truck["driver"]} - Position: [{truck["current_position"]["latitude"]:.4f}, {truck["current_position"]["longitude"]:.4f}] - Base Speed: {truck["base_speed"]:.1f} km/h')
    
    # Start route update listener in a separate thread
    route_thread = threading.Thread(target=listen_for_route_updates, daemon=True)
    route_thread.start()
    
    try:
        produce_truck_data()
    except KeyboardInterrupt:
        print('\n🛑 Stopping...')
        producer.flush()
        route_consumer.close()