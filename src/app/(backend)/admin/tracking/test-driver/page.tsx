'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDriverLocationChannel } from '@/lib/realtime';

/**
 * Test Driver Simulator
 *
 * Simple page to simulate a driver sending location updates via WebSocket.
 * Use this to test the admin dashboard is receiving location updates.
 */
export default function TestDriverPage() {
  const [driverId, setDriverId] = useState('test-driver-001');
  const [driverName, setDriverName] = useState('Test Driver');
  const [lat, setLat] = useState(37.7749); // San Francisco
  const [lng, setLng] = useState(-122.4194);
  const [speed, setSpeed] = useState(25);
  const [isConnected, setIsConnected] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [channel, setChannel] = useState<any>(null);
  const [messageCount, setMessageCount] = useState(0);

  const connect = async () => {
    try {
      const locationChannel = createDriverLocationChannel();

      await locationChannel.subscribe({
        onConnect: () => {
          console.log('[Test Driver] Connected to location channel');
          setIsConnected(true);
        },
        onDisconnect: () => {
          console.log('[Test Driver] Disconnected from location channel');
          setIsConnected(false);
        },
        onError: (error) => {
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
    }
  };

  const sendLocationUpdate = async () => {
    if (!channel || !isConnected) {
      alert('Not connected. Click Connect first.');
      return;
    }

    try {
      // Use broadcastLocationUpdate instead of sendLocationUpdate
      // This sends the event that the admin dashboard is listening for
      await channel.broadcastLocationUpdate({
        driverId,
        driverName,
        lat,
        lng,
        accuracy: 10,
        speed,
        heading: 90,
        batteryLevel: 85,
        isMoving: speed > 0,
        activityType: speed > 5 ? 'driving' : 'stationary',
        timestamp: new Date().toISOString(),
        vehicleNumber: 'VEH-001',
      });

      setMessageCount(prev => prev + 1);
      console.log('[Test Driver] Broadcasted location update:', { driverId, lat, lng, speed });
    } catch (error) {
      console.error('[Test Driver] Failed to send location:', error);
      alert(`Failed to send: ${(error as Error).message}`);
    }
  };

  const startBroadcasting = () => {
    setIsBroadcasting(true);

    const interval = setInterval(() => {
      if (!isConnected) {
        clearInterval(interval);
        setIsBroadcasting(false);
        return;
      }

      // Simulate movement: move slightly north-east
      setLat(prev => prev + 0.0001);
      setLng(prev => prev + 0.0001);

      sendLocationUpdate();
    }, 2000); // Every 2 seconds

    // Store interval ID for cleanup
    (window as any).testDriverInterval = interval;
  };

  const stopBroadcasting = () => {
    setIsBroadcasting(false);
    if ((window as any).testDriverInterval) {
      clearInterval((window as any).testDriverInterval);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Test Driver Simulator</CardTitle>
          <p className="text-sm text-muted-foreground">
            Simulate a driver sending location updates to test the admin dashboard
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
              Messages sent: {messageCount}
            </div>
          </div>

          {/* Driver Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="driverId">Driver ID</Label>
              <Input
                id="driverId"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                disabled={isConnected}
              />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="speed">Speed (m/s)</Label>
              <Input
                id="speed"
                type="number"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {!isConnected ? (
              <Button onClick={connect} className="w-full">
                Connect
              </Button>
            ) : (
              <>
                <Button onClick={disconnect} variant="outline" className="w-full">
                  Disconnect
                </Button>

                <Button
                  onClick={sendLocationUpdate}
                  className="w-full"
                  disabled={isBroadcasting}
                >
                  Send Single Update
                </Button>

                {!isBroadcasting ? (
                  <Button
                    onClick={startBroadcasting}
                    variant="secondary"
                    className="w-full"
                  >
                    Start Auto-Broadcasting (Every 2s)
                  </Button>
                ) : (
                  <Button
                    onClick={stopBroadcasting}
                    variant="destructive"
                    className="w-full"
                  >
                    Stop Auto-Broadcasting
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground space-y-2 pt-4 border-t">
            <p className="font-semibold">How to test:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click "Connect" to establish WebSocket connection</li>
              <li>Open the Admin Tracking page in another tab</li>
              <li>Click "Start Auto-Broadcasting" to simulate driver movement</li>
              <li>Watch the admin dashboard update in real-time</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
