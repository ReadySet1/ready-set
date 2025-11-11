'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDriverLocationChannel, type DriverLocationChannel } from '@/lib/realtime';

/**
 * Test Driver Simulator
 *
 * Simulates a driver traveling from Destino restaurant to TRexBio office.
 * Use this to test the admin dashboard real-time tracking.
 */

// Realistic route from Destino (103 Horne Ave) to TRexBio (681 Gateway Blvd)
const ROUTE_WAYPOINTS = [
  { lat: 37.7267, lng: -122.3865, name: 'Destino Restaurant (Start)' }, // 103 Horne Avenue, SF
  { lat: 37.7250, lng: -122.3880, name: 'Turn onto Bayshore Blvd' },
  { lat: 37.7200, lng: -122.3920, name: 'Continue on Bayshore' },
  { lat: 37.7100, lng: -122.3950, name: 'Approaching Industrial' },
  { lat: 37.7000, lng: -122.3970, name: 'US-101 South entrance' },
  { lat: 37.6800, lng: -122.3980, name: 'On US-101 South' },
  { lat: 37.6700, lng: -122.3990, name: 'Exit Gateway Blvd' },
  { lat: 37.6600, lng: -122.3995, name: 'Turn onto Gateway Blvd' },
  { lat: 37.6560, lng: -122.3995, name: 'TRexBio Office (End)' }, // 681 Gateway Boulevard, SSF
];

export default function TestDriverPage() {
  // Generate a unique test driver UUID that persists across renders
  // Uses crypto.randomUUID() for proper UUID v4 generation
  const [driverId] = useState(() => {
    // Use crypto.randomUUID() for standards-compliant UUID v4
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-000000000001'; // Fallback for older browsers
  });
  const [driverName, setDriverName] = useState('Test Driver');
  const [speed, setSpeed] = useState(15); // m/s (about 33 mph)
  const [isConnected, setIsConnected] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [channel, setChannel] = useState<DriverLocationChannel | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [currentWaypoint, setCurrentWaypoint] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(ROUTE_WAYPOINTS[0]);
  const [progress, setProgress] = useState(0); // Progress between waypoints (0-1)

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = async () => {
    try {
      const locationChannel = createDriverLocationChannel();

      await locationChannel.subscribe({
        onConnect: async () => {
          setIsConnected(true);

          // Send initial location immediately so dashboard shows the driver
          const initialLocation = currentLocation || ROUTE_WAYPOINTS[0]!;
          await locationChannel.broadcastLocationUpdate({
            driverId,
            driverName,
            lat: initialLocation.lat,
            lng: initialLocation.lng,
            accuracy: 10,
            speed: 0, // Stationary at start
            heading: 90,
            batteryLevel: 85,
            isMoving: false,
            activityType: 'stationary',
            timestamp: new Date().toISOString(),
            vehicleNumber: 'VEH-001',
          });
        },
        onDisconnect: () => {
          setIsConnected(false);
        },
        onError: (error: Error) => {
          console.error('[Test Driver] Connection error:', error);
          alert(`Connection error: ${error.message}`);
        },
      });

      setChannel(locationChannel);
    } catch (error) {
      console.error('[Test Driver] Failed to connect:', error);
      alert(`Failed to connect: ${(error as Error).message}`);
    }
  };

  const disconnect = async () => {
    if (channel) {
      await channel.unsubscribe();
      setChannel(null);
      setIsConnected(false);
      setIsBroadcasting(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  };

  const calculateHeading = (from: typeof ROUTE_WAYPOINTS[0] | undefined, to: typeof ROUTE_WAYPOINTS[0] | undefined): number => {
    if (!from || !to) return 0; // Default heading if waypoints missing
    const dLon = to.lng - from.lng;
    const dLat = to.lat - from.lat;
    const heading = Math.atan2(dLon, dLat) * 180 / Math.PI;
    return (heading + 360) % 360; // Normalize to 0-360
  };

  const sendLocationUpdate = async (lat: number, lng: number, heading: number, isMoving: boolean) => {
    if (!channel || !isConnected) {
      return;
    }

    try {
      await channel.broadcastLocationUpdate({
        driverId,
        driverName,
        lat,
        lng,
        accuracy: 10,
        speed: isMoving ? speed : 0,
        heading,
        batteryLevel: Math.max(85 - messageCount * 0.5, 20), // Simulate battery drain
        isMoving,
        activityType: isMoving ? 'driving' : 'stationary',
        timestamp: new Date().toISOString(),
        vehicleNumber: 'VEH-001',
      });

      setMessageCount(prev => prev + 1);
    } catch (error) {
      console.error('[Test Driver] Failed to send location:', error);
    }
  };

  const startBroadcasting = () => {
    setIsBroadcasting(true);

    // Reset to start of route
    setCurrentWaypoint(0);
    setProgress(0);
    setCurrentLocation(ROUTE_WAYPOINTS[0]);

    intervalRef.current = setInterval(() => {
      setProgress(prevProgress => {
        setCurrentWaypoint(prevWaypoint => {
          // Check if we've reached the end of the route
          if (prevWaypoint >= ROUTE_WAYPOINTS.length - 1) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            setIsBroadcasting(false);
            return prevWaypoint;
          }

          const from = ROUTE_WAYPOINTS[prevWaypoint]!;
          const to = ROUTE_WAYPOINTS[prevWaypoint + 1]!;

          // Increment progress (about 10% per update = 5 seconds per segment)
          const newProgress = prevProgress + 0.10;

          if (newProgress >= 1.0) {
            // Move to next waypoint
            const nextWaypoint = prevWaypoint + 1;
            setProgress(0);
            setCurrentLocation(to);

            // Calculate heading for next segment
            if (nextWaypoint < ROUTE_WAYPOINTS.length - 1) {
              const heading = calculateHeading(to, ROUTE_WAYPOINTS[nextWaypoint + 1]);
              sendLocationUpdate(to.lat, to.lng, heading, true);
            } else {
              // At destination, stationary
              sendLocationUpdate(to.lat, to.lng, 0, false);
            }

            return nextWaypoint;
          } else {
            // Interpolate position between waypoints
            const lat = from.lat + (to.lat - from.lat) * newProgress;
            const lng = from.lng + (to.lng - from.lng) * newProgress;
            const heading = calculateHeading(from, to);

            setCurrentLocation({ lat, lng, name: `En route to ${to.name}` });
            sendLocationUpdate(lat, lng, heading, true);

            return prevWaypoint;
          }
        });

        return prevProgress >= 1.0 ? 0 : prevProgress + 0.10;
      });
    }, 500); // Update every 0.5 seconds for smooth movement
  };

  const stopBroadcasting = () => {
    setIsBroadcasting(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const resetRoute = () => {
    setCurrentWaypoint(0);
    setProgress(0);
    setCurrentLocation(ROUTE_WAYPOINTS[0]);
    setMessageCount(0);
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Test Driver Simulator</CardTitle>
          <p className="text-sm text-muted-foreground">
            Simulates a driver traveling from Destino Restaurant to TRexBio Office
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Updates sent: {messageCount}
            </div>
          </div>

          {/* Route Progress */}
          {isConnected && (
            <div className="p-4 bg-blue-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Route Progress</span>
                <span className="text-sm text-muted-foreground">
                  Waypoint {currentWaypoint + 1} of {ROUTE_WAYPOINTS.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentWaypoint + progress) / ROUTE_WAYPOINTS.length) * 100}%`
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {currentLocation?.name || 'Unknown location'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Lat: {currentLocation?.lat?.toFixed(6) || 'N/A'}</div>
                <div>Lng: {currentLocation?.lng?.toFixed(6) || 'N/A'}</div>
              </div>
            </div>
          )}

          {/* Driver Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="driverId">Driver ID (Test UUID)</Label>
              <Input
                id="driverId"
                value={driverId}
                disabled
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Fixed UUID for testing purposes
              </p>
            </div>

            <div>
              <Label htmlFor="driverName">Driver Name</Label>
              <Input
                id="driverName"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                disabled={isConnected}
              />
            </div>

            <div>
              <Label htmlFor="speed">Speed (m/s) - about {Math.round(speed * 2.237)} mph</Label>
              <Input
                id="speed"
                type="number"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                disabled={isBroadcasting}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {!isConnected ? (
              <Button onClick={connect} className="w-full">
                Connect to Realtime
              </Button>
            ) : (
              <>
                <Button onClick={disconnect} variant="outline" className="w-full">
                  Disconnect
                </Button>

                {!isBroadcasting ? (
                  <>
                    <Button
                      onClick={startBroadcasting}
                      variant="default"
                      className="w-full"
                    >
                      Start Route Simulation
                    </Button>
                    <Button
                      onClick={resetRoute}
                      variant="secondary"
                      className="w-full"
                    >
                      Reset to Start
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={stopBroadcasting}
                    variant="destructive"
                    className="w-full"
                  >
                    Stop Simulation
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground space-y-2 pt-4 border-t">
            <p className="font-semibold">Route Details:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Start: Destino Restaurant (103 Horne Ave, SF 94124)</li>
              <li>End: TRexBio Office (681 Gateway Blvd, SSF 94080)</li>
              <li>Updates every 0.5 seconds for smooth movement</li>
              <li>Follows {ROUTE_WAYPOINTS.length} waypoints along the route</li>
            </ul>
            <p className="font-semibold mt-4">How to test:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Click "Connect to Realtime" to establish WebSocket connection</li>
              <li>Driver appears immediately on admin dashboard</li>
              <li>Open Admin Tracking page in another tab</li>
              <li>Click "Start Route Simulation" to begin journey</li>
              <li>Watch the driver move in real-time on the dashboard map</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
