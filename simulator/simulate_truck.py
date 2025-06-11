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

trucks = [
    {
        'truck_id': 'truck_001',
        'plate': 'TUN-1234',
        'driver': 'Ahmed Ben Ali',
        'state': 'At Destination',
        'route': [],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'segment': 0,
        'progress': 0.0,
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
    },
]

initial_coords = [
    ((36.8000, 10.1800), (34.7406, 10.7603)),  # Tunis → Sfax
    ((36.8000, 10.1800), (35.8256, 10.6411)),  # Tunis → Sousse
    ((36.8000, 10.1800), (35.6781, 10.0963)),  # Tunis → Kairouan
]

def delivery_report(err, msg):
    if err:
        print(f'Message delivery failed: {err}')
    else:
        print(f'Message delivered to {msg.topic()} [{msg.partition()}]')

def calculate_bearing(start, end):
    lat1, lon1 = math.radians(start['latitude']), math.radians(start['longitude'])
    lat2, lon2 = math.radians(end['latitude']), math.radians(end['longitude'])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360

def get_interpolated_position(start, end, progress):
    lat = start['latitude'] + (end['latitude'] - start['latitude']) * progress
    lon = start['longitude'] + (end['longitude'] - start['longitude']) * progress
    bearing = calculate_bearing(start, end)
    return {'latitude': lat, 'longitude': lon, 'bearing': bearing}

def test_osrm_connectivity():
    """Test OSRM service connectivity and return the working endpoint"""
    profile = os.getenv('OSRM_PROFILE', 'truck')
    host = os.getenv('OSRM_HOST', 'osrm')
    port = os.getenv('OSRM_PORT', '5000')
    
    # Test coordinates (Tunis center)
    test_coords = "10.1800,36.8000;10.1900,36.8100"
    
    possible_endpoints = [
        f'http://{host}:{port}',
        f'http://localhost:{port}',
        f'http://127.0.0.1:{port}',
        f'http://osrm:{port}',
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://osrm:5000',
    ]
    
    print("Testing OSRM connectivity...")
    
    for endpoint in possible_endpoints:
        try:
            test_url = f'{endpoint}/route/v1/{profile}/{test_coords}?overview=false'
            print(f'Testing: {test_url}')
            
            response = requests.get(test_url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                if 'routes' in data and len(data['routes']) > 0:
                    print(f'✅ OSRM service is working at: {endpoint}')
                    return endpoint
                else:
                    print(f'❌ OSRM returned invalid response at {endpoint}')
            else:
                print(f'❌ OSRM returned status {response.status_code} at {endpoint}')
                
        except requests.exceptions.ConnectionError:
            print(f'❌ Connection refused at {endpoint}')
        except requests.exceptions.Timeout:
            print(f'❌ Timeout at {endpoint}')
        except Exception as e:
            print(f'❌ Error testing {endpoint}: {e}')
    
    print('⚠️  No working OSRM endpoint found!')
    return None

def fetch_osrm_route(departure, destination, max_retries=3):
    """Fetch route from OSRM with improved error handling"""
    profile = os.getenv('OSRM_PROFILE', 'truck')
    
    # Get working OSRM endpoint
    osrm_endpoint = test_osrm_connectivity()
    
    if not osrm_endpoint:
        print('OSRM service not available, using fallback route')
        return create_fallback_route(departure, destination)
    
    for attempt in range(max_retries):
        try:
            url = f'{osrm_endpoint}/route/v1/{profile}/{departure[1]},{departure[0]};{destination[1]},{destination[0]}?geometries=geojson&overview=full&steps=true'
            
            print(f'Fetching route (attempt {attempt + 1}/{max_retries}): {url}')
            
            response = requests.get(url, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            if 'routes' in data and len(data['routes']) > 0:
                route_data = data['routes'][0]
                coords = route_data['geometry']['coordinates']
                
                # Convert coordinates to proper format
                route = [{'latitude': lat, 'longitude': lon} for lon, lat in coords]
                
                distance = route_data.get('distance', 0) / 1000  # Convert to km
                duration = route_data.get('duration', 0) / 60    # Convert to minutes
                
                print(f'✅ Route fetched successfully: {len(route)} points, {distance:.1f}km, {duration:.1f}min')
                return route
            else:
                print('❌ No routes found in OSRM response')
                
        except requests.exceptions.RequestException as e:
            print(f'❌ OSRM request failed (attempt {attempt + 1}): {e}')
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
        except Exception as e:
            print(f'❌ Unexpected error fetching route: {e}')
    
    print('All OSRM attempts failed, using fallback route')
    return create_fallback_route(departure, destination)

def create_fallback_route(departure, destination):
    """Create a simple fallback route when OSRM is unavailable"""
    print(f'Creating fallback route from {departure} to {destination}')
    
    # Create a simple route with intermediate points
    start_lat, start_lon = departure
    end_lat, end_lon = destination
    
    # Add some intermediate points for a more realistic route
    route = []
    num_points = 10
    
    for i in range(num_points + 1):
        progress = i / num_points
        lat = start_lat + (end_lat - start_lat) * progress
        lon = start_lon + (end_lon - start_lon) * progress
        
        # Add some randomness to make it look more like a real route
        if i > 0 and i < num_points:
            lat += random.uniform(-0.01, 0.01)
            lon += random.uniform(-0.01, 0.01)
        
        route.append({'latitude': lat, 'longitude': lon})
    
    print(f'Fallback route created with {len(route)} points')
    return route

def on_message(ws, message):
    try:
        data = json.loads(message)
        print(f'WebSocket message received: {data}')
        
        if data.get('event') == 'truckRouteUpdate':
            truck_id = data.get('truck_id')
            route = data.get('route', [])
            
            if len(route) >= 2:
                for truck in trucks:
                    if truck['truck_id'] == truck_id:
                        truck['route'] = route
                        truck['segment'] = 0
                        truck['progress'] = 0.0
                        truck['state'] = 'En Route'
                        print(f'✅ Route updated for {truck_id} with {len(route)} points')
                        break
            else:
                print(f'❌ Invalid route data for {truck_id}: {len(route)} points')
                
    except json.JSONDecodeError as e:
        print(f'❌ Invalid JSON in WebSocket message: {e}')
    except Exception as e:
        print(f'❌ WebSocket message error: {e}')

def on_error(ws, error):
    print(f'❌ WebSocket error: {error}')

def on_close(ws, close_status_code, close_msg):
    print(f'🔌 WebSocket closed: {close_status_code}, {close_msg}')

def on_open(ws):
    print('🔌 WebSocket connected to backend')

def ws_thread_func():
    backend_url = os.getenv('BACKEND_WS_URL', 'ws://backend:3000')
    
    while True:
        try:
            print(f'Connecting to WebSocket at: {backend_url}')
            ws = websocket.WebSocketApp(
                backend_url,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close,
                on_open=on_open
            )
            ws.run_forever()
        except Exception as e:
            print(f'❌ WebSocket connection error: {e}')
            print('Retrying WebSocket connection in 5 seconds...')
            time.sleep(5)

def simulate_truck_data(truck):
    """Simulate truck data with improved error handling"""
    try:
        # Initialize route if not exists
        if not truck['route']:
            i = int(truck['truck_id'].split('_')[-1]) - 1
            origin, dest = initial_coords[i % len(initial_coords)]
            truck['route'] = fetch_osrm_route(origin, dest)
            print(f'Initialized route for {truck["truck_id"]} with {len(truck["route"])} points')

        # Check if truck has reached destination
        if truck['segment'] >= len(truck['route']) - 1:
            truck['progress'] = 1.0
            truck['state'] = 'At Destination'
        else:
            truck['state'] = 'En Route' if truck['progress'] > 0 else 'Idle'

        # Get current position
        start = truck['route'][truck['segment']]
        end = truck['route'][min(truck['segment'] + 1, len(truck['route']) - 1)]
        gps = get_interpolated_position(start, end, truck['progress'])

        # Check if at destination
        is_dest = truck['segment'] == len(truck['route']) - 1 and truck['progress'] >= 0.99
        if is_dest:
            gps['bearing'] = None
            truck['weight'] = 0
            truck['loaded'] = False

        return {
            'truck_id': truck['truck_id'],
            'plate': truck['plate'],
            'driver': truck['driver'],
            'state': truck['state'],
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'gps': gps,
            'weight': round(truck['weight'], 2),
            'direction': gps['bearing'],
            'departure_latitude': truck['route'][0]['latitude'],
            'departure_longitude': truck['route'][0]['longitude'],
            'destination_latitude': truck['route'][-1]['latitude'],
            'destination_longitude': truck['route'][-1]['longitude'],
            'is_at_destination': is_dest,
            'speed': random.uniform(40, 80) if truck['state'] == 'En Route' else 0,
            'fuel_level': random.uniform(20, 100),
            'engine_temp': random.uniform(80, 95),
            'route_progress': (truck['segment'] + truck['progress']) / len(truck['route']) * 100
        }
        
    except Exception as e:
        print(f'❌ Error simulating data for {truck.get("truck_id", "unknown")}: {e}')
        return None

def produce_truck_data():
    """Main data production loop"""
    # Start WebSocket thread
    threading.Thread(target=ws_thread_func, daemon=True).start()
    
    # Test OSRM connectivity at startup
    print("🔍 Testing OSRM connectivity at startup...")
    test_osrm_connectivity()
    
    topic = 'truck-data'
    interval = 1.0  
    step_size = 0.005 

    print(f'🚛 Starting truck data production to topic: {topic}')
    print(f'⏱️  Update interval: {interval}s, Step size: {step_size}')

    while True:
        for truck in trucks:
            try:
                data = simulate_truck_data(truck)
                
                if data:  # Only send if data is valid
                    producer.produce(
                        topic, 
                        json.dumps(data).encode('utf-8'), 
                        callback=delivery_report
                    )
                    producer.flush()
                    
                    print(f' Sent: {data["truck_id"]} - {data["state"]} - Lat: {data["gps"]["latitude"]:.6f}, Lon: {data["gps"]["longitude"]:.6f} - Progress: {data.get("route_progress", 0):.1f}%')
                    
                    # Update truck progress
                    if truck['state'] == 'En Route':
                        truck['progress'] += step_size
                        if truck['progress'] >= 1.0:
                            truck['progress'] = 0.0
                            truck['segment'] += 1
                            
                            # Check if delivery is complete
                            if truck['segment'] >= len(truck['route']) - 1 and not truck['loaded']:
                                print(f'🏁 {truck["truck_id"]} completed delivery, starting new route')
                                i = int(truck['truck_id'].split('_')[-1]) - 1
                                origin, dest = initial_coords[i % len(initial_coords)]
                                truck['route'] = fetch_osrm_route(origin, dest)
                                truck['segment'] = 0
                                truck['progress'] = 0.0
                                truck['weight'] = random.uniform(5000, 20000)
                                truck['loaded'] = True
                                truck['state'] = 'En Route'
                                
            except Exception as e:
                print(f'Error processing truck {truck.get("truck_id", "unknown")}: {e}')
        
        time.sleep(interval)

if __name__ == '__main__':
    print('🚛 Starting Heavy Truck IoT Simulator...')
    print('Press Ctrl+C to stop')
    try:
        produce_truck_data()
    except KeyboardInterrupt:
        print('\n Shutting down gracefully...')
        producer.flush()
        print(' Goodbye!')