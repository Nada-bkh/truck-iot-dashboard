import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

const MultiRoutingMachine = ({ routes, selectedRouteId, onRouteSelect, truckSpeed = 50 }) => {
  const map = useMap();
  const routingControlsRef = useRef([]);

  // Calculate real-time ETA based on truck speed
  const calculateRealTimeETA = (route, currentSpeed) => {
    if (!route || !route.distanceKm) return { eta: 'N/A', remaining: 'N/A' };
    
    const speed = currentSpeed > 5 ? currentSpeed : route.avgSpeedKmh; // Use current speed if moving
    const timeHours = route.distanceKm / speed;
    const timeMinutes = timeHours * 60;
    
    const now = new Date();
    const eta = new Date(now.getTime() + timeMinutes * 60000);
    
    return {
      eta: eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      remaining: `${Math.round(timeMinutes)} min`,
      speed: Math.round(speed)
    };
  };

  // Enhanced route colors and styles
  const getRouteStyle = (route, isSelected) => {
    const styles = {
      fastest: {
        color: isSelected ? '#3B82F6' : '#1E40AF',
        weight: isSelected ? 8 : 5,
        opacity: isSelected ? 0.9 : 0.7,
        dashArray: null,
        className: 'fastest-route'
      },
      shortest: {
        color: isSelected ? '#10B981' : '#047857',
        weight: isSelected ? 8 : 5,
        opacity: isSelected ? 0.9 : 0.6,
        dashArray: null,
        className: 'shortest-route'
      },
      alternative: {
        color: isSelected ? '#8B5CF6' : '#6D28D9',
        weight: isSelected ? 8 : 4,
        opacity: isSelected ? 0.9 : 0.5,
        dashArray: '10, 5',
        className: 'alternative-route'
      }
    };

    return styles[route.type] || styles.alternative;
  };

  useEffect(() => {
    if (!map || !routes || !Array.isArray(routes) || routes.length === 0) {
      // Clear existing routes
      routingControlsRef.current.forEach(control => {
        if (control && map.hasLayer(control)) {
          map.removeControl(control);
        }
      });
      routingControlsRef.current = [];
      return;
    }

    // Clear existing routing controls
    routingControlsRef.current.forEach(control => {
      if (control && map.hasLayer(control)) {
        map.removeControl(control);
      }
    });
    routingControlsRef.current = [];

    // Create routing controls for each route
    routes.forEach((route, index) => {
      if (!route.waypoints || route.waypoints.length < 2) return;

      const isSelected = selectedRouteId === route.id;
      const style = getRouteStyle(route, isSelected);
      const etaInfo = calculateRealTimeETA(route, truckSpeed);

      // Create waypoints from route data
      const waypoints = [
        L.latLng(route.waypoints[0].latitude, route.waypoints[0].longitude),
        L.latLng(route.waypoints[route.waypoints.length - 1].latitude, route.waypoints[route.waypoints.length - 1].longitude)
      ];

      const routingControl = L.Routing.control({
        waypoints: waypoints,
        router: L.Routing.osrmv1({
          serviceUrl: 'http://localhost:5000/route/v1',
          profile: 'truck',
        }),
        lineOptions: {
          styles: [style],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
        createMarker: (i, waypoint, n) => {
          // Only create markers for start and end points of the main route
          if (!route.isMain) return null;
          
          if (i === 0) {
            // Start marker
            return L.marker(waypoint.latLng, {
              icon: L.divIcon({
                html: `
                  <div style="
                    background: ${style.color};
                    border: 3px solid white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                  ">S</div>
                `,
                className: 'route-start-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            });
          } else if (i === n - 1) {
            // End marker
            return L.marker(waypoint.latLng, {
              icon: L.divIcon({
                html: `
                  <div style="
                    background: ${style.color};
                    border: 3px solid white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                  ">E</div>
                `,
                className: 'route-end-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            });
          }
          return null;
        },
        show: false,
        addWaypoints: false,
        routeWhileDragging: false,
        fitSelectedRoutes: false,
        summaryTemplate: `
          <div class="route-summary" style="
            background: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border: 2px solid ${style.color};
            margin: 4px 0;
            cursor: pointer;
            transition: all 0.2s ease;
            ${isSelected ? 'transform: scale(1.02);' : ''}
          " onclick="window.selectRoute && window.selectRoute('${route.id}')">
            <div style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 8px;
            ">
              <h4 style="
                margin: 0;
                color: ${style.color};
                font-size: 14px;
                font-weight: 700;
              ">${route.description}</h4>
              <span style="
                background: ${style.color}20;
                color: ${style.color};
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
              ">${isSelected ? '✓ Active' : 'Select'}</span>
            </div>
            <div style="
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              font-size: 12px;
            ">
              <div>
                <div style="color: #6B7280;">Distance</div>
                <div style="font-weight: 600; color: #1F2937;">${route.distanceKm} km</div>
              </div>
              <div>
                <div style="color: #6B7280;">ETA</div>
                <div style="font-weight: 600; color: #1F2937;">${etaInfo.eta}</div>
              </div>
              <div>
                <div style="color: #6B7280;">Duration</div>
                <div style="font-weight: 600; color: #1F2937;">${etaInfo.remaining}</div>
              </div>
              <div>
                <div style="color: #6B7280;">Avg Speed</div>
                <div style="font-weight: 600; color: #1F2937;">${etaInfo.speed} km/h</div>
              </div>
            </div>
          </div>
        `
      }).addTo(map);

      // Handle route selection
      routingControl.on('routesfound', (e) => {
        console.log(`Route ${route.id} found:`, route.description);
        
        // Add click handler for route selection
        const routeElement = routingControl.getContainer();
        if (routeElement) {
          routeElement.addEventListener('click', () => {
            if (onRouteSelect) onRouteSelect(route.id);
          });
        }
      });

      routingControl.on('routingerror', (e) => {
        console.error(`Routing error for ${route.id}:`, e.error?.message || e.error);
      });

      routingControlsRef.current.push(routingControl);
    });

    // Expose route selection function globally for HTML click handlers
    window.selectRoute = (routeId) => {
      if (onRouteSelect) onRouteSelect(routeId);
    };

    // Cleanup function
    return () => {
      routingControlsRef.current.forEach(control => {
        if (control && map.hasLayer(control)) {
          map.removeControl(control);
        }
      });
      routingControlsRef.current = [];
      window.selectRoute = null;
    };
  }, [map, routes, selectedRouteId, truckSpeed, onRouteSelect]);

  return null;
};

export default MultiRoutingMachine;