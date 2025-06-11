#!/usr/bin/env python3
"""
OSRM Diagnostic Script
This script helps diagnose OSRM connection issues for the truck tracking system.
"""

import requests
import json
import time
import os
import subprocess
import socket

def check_port_open(host, port):
    """Check if a port is open on a host"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False

def test_osrm_endpoints():
    """Test various OSRM endpoint configurations"""
    print("🔍 Testing OSRM Endpoints")
    print("=" * 50)
    
    # Test coordinates (Tunis area)
    test_coords = "10.1800,36.8000;10.1900,36.8100"
    
    endpoints = [
        ('localhost', 5000),
        ('127.0.0.1', 5000),
        ('osrm', 5000),
        ('localhost', 5001),
        ('127.0.0.1', 5001),
    ]
    
    profiles = ['truck', 'driving', 'car']
    
    for host, port in endpoints:
        print(f"\n🌐 Testing {host}:{port}")
        
        # Check if port is open
        if check_port_open(host, port):
            print(f"✅ Port {port} is open on {host}")
        else:
            print(f"❌ Port {port} is closed on {host}")
            continue
        
        for profile in profiles:
            try:
                url = f'http://{host}:{port}/route/v1/{profile}/{test_coords}?overview=false'
                print(f"   Testing profile '{profile}': {url}")
                
                response = requests.get(url, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'routes' in data and len(data['routes']) > 0:
                        distance = data['routes'][0].get('distance', 0) / 1000
                        duration = data['routes'][0].get('duration', 0) / 60
                        print(f"   ✅ Profile '{profile}' works! Distance: {distance:.1f}km, Duration: {duration:.1f}min")
                    else:
                        print(f"   ❌ Profile '{profile}' returned no routes")
                else:
                    print(f"   ❌ Profile '{profile}' returned status {response.status_code}")
                    
            except requests.exceptions.ConnectionError:
                print(f"   ❌ Profile '{profile}' - Connection refused")
            except requests.exceptions.Timeout:
                print(f"   ❌ Profile '{profile}' - Request timeout")
            except Exception as e:
                print(f"   ❌ Profile '{profile}' - Error: {e}")

def test_tunisia_coordinates():
    """Test routing with actual Tunisia coordinates"""
    print("\n🇹🇳 Testing Tunisia Route Calculations")
    print("=" * 50)
    
    # Tunisia test routes
    routes = [
        ("Tunis to Sfax", (36.8000, 10.1800), (34.7406, 10.7603)),
        ("Tunis to Sousse", (36.8000, 10.1800), (35.8256, 10.6411)),
        ("Tunis to Kairouan", (36.8000, 10.1800), (35.6781, 10.0963)),
        ("Sfax to Gabes", (34.7406, 10.7603), (33.8815, 10.0982)),
    ]
    
    endpoints = ['http://localhost:5000', 'http://127.0.0.1:5000', 'http://osrm:5000']
    
    for endpoint in endpoints:
        print(f"\n🌐 Testing endpoint: {endpoint}")
        
        for route_name, start, end in routes:
            try:
                coords = f"{start[1]},{start[0]};{end[1]},{end[0]}"
                url = f'{endpoint}/route/v1/truck/{coords}?geometries=geojson&overview=full'
                
                print(f"   🛣️  {route_name}: ", end="")
                
                response = requests.get(url, timeout=15)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'routes' in data and len(data['routes']) > 0:
                        route_data = data['routes'][0]
                        distance = route_data.get('distance', 0) / 1000
                        duration = route_data.get('duration', 0) / 3600
                        coords_count = len(route_data['geometry']['coordinates'])
                        print(f"✅ {distance:.1f}km, {duration:.1f}h, {coords_count} points")
                    else:
                        print("❌ No routes found")
                else:
                    print(f"❌ HTTP {response.status_code}")
                    
            except Exception as e:
                print(f"❌ Error: {e}")

def check_docker_containers():
    """Check if OSRM is running in Docker"""
    print("\n🐳 Checking Docker Containers")
    print("=" * 50)
    
    try:
        result = subprocess.run(['docker', 'ps'], capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            osrm_containers = [line for line in lines if 'osrm' in line.lower()]
            
            if osrm_containers:
                print("✅ Found OSRM containers:")
                for container in osrm_containers:
                    print(f"   {container}")
            else:
                print("❌ No OSRM containers found")
                print("   Available containers:")
                for line in lines[1:]:
                    if line.strip():
                        print(f"   {line}")
        else:
            print("❌ Could not run 'docker ps' command")
            
    except FileNotFoundError:
        print("❌ Docker command not found")
    except Exception as e:
        print(f"❌ Error checking Docker: {e}")

def check_environment_variables():
    """Check relevant environment variables"""
    print("\n🔧 Environment Variables")
    print("=" * 50)
    
    env_vars = [
        'OSRM_HOST',
        'OSRM_PORT', 
        'OSRM_PROFILE',
        'KAFKA_BROKERS',
        'BACKEND_WS_URL'
    ]
    
    for var in env_vars:
        value = os.getenv(var)
        if value:
            print(f"✅ {var}={value}")
        else:
            print(f"❌ {var} not set")

def generate_sample_route():
    """Generate a sample route for testing"""
    print("\n📍 Sample Route Generation")
    print("=" * 50)
    
    # Try to get a working OSRM endpoint
    endpoints = ['http://localhost:5000', 'http://127.0.0.1:5000']
    
    for endpoint in endpoints:
        try:
            # Tunis to Sfax
            coords = "10.1800,36.8000;10.7603,34.7406"
            url = f'{endpoint}/route/v1/truck/{coords}?geometries=geojson&overview=full&steps=true'
            
            print(f"Testing: {url}")
            
            response = requests.get(url, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'routes' in data and len(data['routes']) > 0:
                    route = data['routes'][0]
                    print(f"✅ Route generated successfully!")
                    print(f"   Distance: {route.get('distance', 0)/1000:.1f} km")
                    print(f"   Duration: {route.get('duration', 0)/3600:.1f} hours")
                    print(f"   Coordinates: {len(route['geometry']['coordinates'])} points")
                    
                    # Save route to file for inspection
                    with open('sample_route.json', 'w') as f:
                        json.dump(data, f, indent=2)
                    print(f"   Route saved to: sample_route.json")
                    
                    return True
                    
        except Exception as e:
            print(f"❌ Error with {endpoint}: {e}")
    
    print("❌ Could not generate sample route")
    return False

def main():
    """Run all diagnostic tests"""
    print("🚛 OSRM Diagnostic Tool for Heavy Truck Tracking")
    print("=" * 60)
    
    check_environment_variables()
    check_docker_containers()
    test_osrm_endpoints()
    test_tunisia_coordinates()
    generate_sample_route()
    
    print("\n" + "=" * 60)
    print("🔧 Troubleshooting Tips:")
    print("1. Make sure OSRM server is running with Tunisia data")
    print("2. Check if 'truck' profile is available (try 'driving' as fallback)")
    print("3. Verify Docker container ports are correctly mapped")
    print("4. Test with localhost:5000 first, then container names")
    print("5. Check firewall settings if using remote OSRM server")

if __name__ == '__main__':
    main()