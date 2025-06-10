# Truck IoT Dashboard

The Truck IoT Dashboard is a real-time tracking application for heavy trucks, developed during an internship at ESPRIT. It visualizes truck movements on a Leaflet map with a purple polyline representing routes optimized by OSRM (Open Source Routing Machine). The system leverages Kafka and WebSocket for data streaming, a React/Tailwind CSS frontend, and a Node.js backend, all orchestrated with Docker.

## Features
- **Real-Time Tracking**: Updates truck GPS positions every 0.25 seconds.
- **Truck-Optimized Routing**: Uses OSRM with a `truck.lua` profile for safe, efficient routes.
- **Interactive UI**: Displays routes and truck data on a Leaflet map with Tailwind CSS styling.
- **Data Pipeline**: Streams GPS and weight data via Kafka and WebSocket.

## Project Structure
- `frontend/frontend/`: React application with Leaflet for map visualization.
- `backend/`: Node.js server managing WebSocket connections and Kafka consumer.
- `truck-simulator/`: Python script simulating truck GPS and weight data.
- `osrm-data/`: Stores `central-america-latest.osm.pbf` for OSRM routing.
- `osrm-profiles/`: Contains `truck.lua` for truck-specific routing.

## Prerequisites
- Docker and Docker Compose
- Node.js (v18 or later)
- Python (3.8 or later)
- Git
- ~20GB disk space and 16GB RAM for OSRM

## Setup Instructions
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Nada-bkh/truck-iot-dashboard.git
   cd truck-iot-dashboard
**Download OSRM Data**:

Download central-america-latest.osm.pbf and place it in osrm-data/:

    wget -O osrm-data/central-america-latest.osm.pbf https://download.geofabrik.de/central-america-latest.osm.pbf

**Install Frontend Dependencies**:

    cd frontend/frontend
    npm install
    cd ../..
**Build and Run with Docker**:

    docker-compose up --build -d

**Access the Dashboard**:

 Open http://localhost:5173 in a browser.

**Service endpoints**:

*  OSRM: localhost:5000
* 
*  Backend/WebSocket: localhost:3000
*  
*  Kafka: localhost:9092

**Usage**
 
 Navigate to http://localhost:5173.

 Enter a departure (e.g., "Avenida Balboa, Panama City") and destination (e.g., "Calle Central, David").

 Observe the truck moving along the purple polyline, with weight dropping to 0 upon reaching the destination.

**Debugging**

View Docker logs:

    docker logs osrm
    docker logs backend
    docker logs truck-simulator

Check browser console at http://localhost:5173 for map and WebSocket logs.

**Technologies**

*  Frontend: React, Leaflet, Tailwind CSS, Vite
* 
*  Backend: Node.js, Socket.IO, KafkaJS
*  
*  Data Pipeline: Confluent Kafka, Python
* 
*  Routing: OSRM with truck.lua profile
* 
*  Containerization: Docker

**Future Improvements**

*  Improve OSRM error handling for robust routing.
* 
*  Integrate real-time traffic data.
* 
*  Support tracking multiple trucks simultaneously.

**Contact**

Nada Bkh - nada.benkhlifa@esprit.tn

Internship Project, June 2025