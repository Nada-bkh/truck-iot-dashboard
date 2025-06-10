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
    'bootstrap.servers': os.getenv('KAFKA_BROKERS', 'kafka:9091'),
    'client.id': 'truck-iot-producer',
    'retries': 5,
    'retry.backoff.ms': 1000
}
producer = Producer(conf)

trucks = [
    {
        'truck_id': 'truck_001',
        'plate': 'PAN-1234',
        'driver': 'Juan Perez',
        'state': 'At Destination',
        'route': [
            {'latitude': 8.9824, 'longitude': -79.5199},  # Panama City
            {'latitude': 8.4273, 'longitude': -82.4308},  # David
        ],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'segment': 0,
        'progress': 0.0,
    },
    {
        'truck_id': 'truck_002',
        'plate': 'PAN-5678',
        'driver': 'Maria Gomez',
        'state': 'En Route',
        'route': [
            {'latitude': 8.9606, 'longitude': -79.5370},  # Panama City Port
            {'latitude': 8.9493, 'longitude': -82.6147},  # Boquete
        ],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'segment': 0,
        'progress': 0.0,
    },
    {
        'truck_id': 'truck_003',
        'plate': 'PAN-9012',
        'driver': 'Carlos Ruiz',
        'state': 'Idle',
        'route': [
            {'latitude': 9.0012, 'longitude': -79.5012},  # Near Panama City
            {'latitude': 8.9500, 'longitude': -79.5500},  # Nearby
        ],
        'weight': random.uniform(5000, 20000),
        'loaded': True,
        'segment': 0,
        'progress': 0.0,
    },
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

def fetch_osrm_route(departure, destination, retries=3, delay=5):
    profile = os.getenv('OSRM_PROFILE', 'truck')
    host = os.getenv('OSRM_HOST', 'osrm')
    port = os.getenv('OSRM_PORT', '5000')
    url = (
        f'http://{host}:{port}/route/v1/{profile}/{departure["longitude"]},{departure["latitude"]};'
        f'{destination["longitude"]},{destination["latitude"]}?geometries=geojson&overview=full&steps=true&annotations=true'
    )
    for i in range(retries):
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            if data['code'] != 'Ok' or not data['routes']:
                raise ValueError(f"Invalid OSRM response: {data}")
            coords = data['routes'][0]['geometry']['coordinates']
            return [{'latitude': lat, 'longitude': lon} for lon, lat in coords]
        except Exception as e:
            print(f'OSRM fetch failed (attempt {i+1}/{retries}): {e}')
            time.sleep(delay)
    print('OSRM route fetch failed permanently')
    return [{'latitude': departure['latitude'], 'longitude': departure['longitude']},
            {'latitude': destination['latitude'], 'longitude': destination['longitude']}]

def on_message(ws, message):
    try:
        data = json.loads(message)
        if data.get('event') == 'truckRouteUpdate':
            truck_id = data.get('truck_id')
            route = data['route']
            if len(route) < 2 or not all('latitude' in wp and 'longitude' in wp for wp in route):
                raise ValueError('Invalid route')
            for truck in trucks:
                if truck['truck_id'] == truck_id:
                    truck['route'] = route
                    truck['segment'] = 0
                    truck['progress'] = 0.0
                    print(f'Route updated for {truck_id}: {len(route)} points')
        elif data.get('event') == 'routeError':
            print(f'Route error from server: {data["message"]}')
    except Exception as e:
        print(f'WebSocket message error: {e}')

def ws_thread_func():
    ws = websocket.WebSocketApp(
        'ws://backend:3000',
        on_message=on_message,
        on_error=lambda ws, e: print(f'WS error: {e}'),
        on_close=lambda ws, code, msg: print(f'WS closed: {code}, {msg}'),
        on_open=lambda ws: print('WS connected')
    )
    ws.run_forever()

def simulate_truck_data(truck):
    truck_id = truck['truck_id']
    if len(truck['route']) < 2:
        print(f'No route for {truck_id}: fetching...')
        new_route = fetch_osrm_route(truck['route'][0], truck['route'][-1])
        truck['route'] = new_route
        truck['segment'] = 0
        truck['progress'] = 0.0

    if truck['segment'] >= len(truck['route']) - 1:
        truck['progress'] = 1.0
        truck['state'] = 'At Destination'
    else:
        truck['state'] = 'En Route' if truck['progress'] > 0 else 'Idle'
    start = truck['route'][truck['segment']]
    end = truck['route'][min(truck['segment'] + 1, len(truck['route']) - 1)]
    gps = get_interpolated_position(start, end, truck['progress'])

    is_dest = truck['segment'] == len(truck['route']) - 1 and truck['progress'] >= 0.99
    if is_dest:
        gps['bearing'] = None
        truck['weight'] = 0
        truck['loaded'] = False

    return {
        'truck_id': truck_id,
        'plate': truck['plate'],
        'driver': truck['driver'],
        'state': truck['state'],
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'gps': gps,
        'weight': truck['weight'],
        'direction': gps['bearing'],
        'departure': truck['route'][0],
        'destination': truck['route'][-1],
        'is_at_destination': is_dest
    }

def produce_truck_data():
    threading.Thread(target=ws_thread_func, daemon=True).start()
    topic = 'truck-data'
    total_steps = 200
    interval = 0.25

    while True:
        for truck in trucks:
            data = simulate_truck_data(truck)
            try:
                producer.produce(topic, json.dumps(data).encode(), callback=delivery_report)
                producer.flush()
                print(f'Sent: {data}')
            except Exception as e:
                print(f'Kafka produce error: {e}')

            truck['progress'] += 1 / total_steps
            if truck['progress'] >= 1.0:
                truck['progress'] = 0.0
                truck['segment'] += 1
                if truck['segment'] >= len(truck['route']) - 1 and not truck['loaded']:
                    truck['weight'] = random.uniform(5000, 20000)
                    truck['loaded'] = True
                    truck['segment'] = 0
                    truck['progress'] = 0.0
                    new_route = fetch_osrm_route(truck['route'][0], truck['route'][-1])
                    truck['route'] = new_route
        time.sleep(interval)

if __name__ == '__main__':
    produce_truck_data()