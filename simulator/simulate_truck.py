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
    'bootstrap.servers': os.getenv('KAFKA_BROKERS', 'localhost:9092'),
    'client.id': 'truck-iot-producer',
    'retries': 5,
    'retry.backoff.ms': 1000
}
producer = Producer(conf)

current_route = [
    {'latitude': 8.9824, 'longitude': -79.5199},  # Panama City
    {'latitude': 8.4273, 'longitude': -82.4308},  # David
]
weight_info = {'weight': random.uniform(5000, 20000), 'loaded': True}
current_segment = 0
segment_progress = 0.0

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
    url = (
        f'http://localhost:5000/route/v1/{profile}/{departure["longitude"]},{departure["latitude"]};'
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
    return None

def on_message(ws, message):
    global current_route, current_segment, segment_progress
    try:
        data = json.loads(message)
        if data.get('event') == 'truckRouteUpdate':
            route = data['route']
            if len(route) < 2 or not all('latitude' in wp and 'longitude' in wp for wp in route):
                raise ValueError('Invalid route')
            current_route[:] = route
            current_segment = 0
            segment_progress = 0.0
            print(f'Route updated: {len(current_route)} points')
        elif data.get('event') == 'routeError':
            print(f'Route error from server: {data["message"]}')
    except Exception as e:
        print(f'WebSocket message error: {e}')

def ws_thread_func():
    ws = websocket.WebSocketApp(
        'ws://localhost:3000',
        on_message=on_message,
        on_error=lambda ws, e: print(f'WS error: {e}'),
        on_close=lambda ws, code, msg: print(f'WS closed: {code}, {msg}'),
        on_open=lambda ws: print('WS connected')
    )
    ws.run_forever()

def simulate_truck_data(truck_id):
    global current_segment, segment_progress, weight_info
    if len(current_route) < 2:
        print('No route: fetching...')
        nr = fetch_osrm_route(current_route[0], current_route[-1])
        if nr:
            current_route[:] = nr
            current_segment = 0
            segment_progress = 0.0
        else:
            print('Using default route')
            return None

    if current_segment >= len(current_route) - 1:
        segment_progress = 1.0
    start = current_route[current_segment]
    end = current_route[min(current_segment + 1, len(current_route) - 1)]
    gps = get_interpolated_position(start, end, segment_progress)

    is_dest = current_segment == len(current_route) - 1 and segment_progress >= 0.99
    if is_dest:
        gps['bearing'] = None
        weight_info['weight'] = 0
        weight_info['loaded'] = False

    return {
        'truck_id': truck_id,
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'gps': gps,
        'weight': weight_info['weight'],
        'direction': gps['bearing'],
        'departure': current_route[0],
        'destination': current_route[-1],
        'is_at_destination': is_dest
    }

def produce_truck_data():
    threading.Thread(target=ws_thread_func, daemon=True).start()
    topic = 'truck-data'
    truck_id = 'truck_001'
    total_steps = 200
    interval = 0.25

    global current_segment, segment_progress, weight_info
    while True:
        data = simulate_truck_data(truck_id)
        if data:
            try:
                producer.produce(topic, json.dumps(data).encode(), callback=delivery_report)
                producer.flush()
                print(f'Sent: {data}')
            except Exception as e:
                print(f'Kafka produce error: {e}')
        else:
            print('No data to send')

        segment_progress += 1 / total_steps
        if segment_progress >= 1.0:
            segment_progress = 0.0
            current_segment += 1
            if current_segment >= len(current_route) - 1 and not weight_info['loaded']:
                weight_info['weight'] = random.uniform(5000, 20000)
                weight_info['loaded'] = True
                current_segment = 0
                segment_progress = 0.0
                nr = fetch_osrm_route(current_route[0], current_route[-1])
                if nr:
                    current_route[:] = nr
        time.sleep(interval)

if __name__ == '__main__':
    produce_truck_data()