'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  TruckIcon, 
  MapPinIcon, 
  ClockIcon, 
  UserIcon,
  PlusIcon,
  SearchIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { assignDeliveryToDriver } from '@/app/actions/tracking/delivery-actions';
import type { TrackedDriver, DeliveryTracking } from '@/types/tracking';

interface DeliveryAssignmentPanelProps {
  drivers: TrackedDriver[];
  deliveries: DeliveryTracking[];
  className?: string;
}

export default function DeliveryAssignmentPanel({ 
  drivers, 
  deliveries, 
  className 
}: DeliveryAssignmentPanelProps) {
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unassigned' | 'assigned' | 'in_progress'>('all');

  // Filter deliveries
  const filteredDeliveries = deliveries.filter(delivery => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        delivery.id.toLowerCase().includes(searchLower) ||
        delivery.cateringRequestId?.toLowerCase().includes(searchLower) ||
        delivery.onDemandId?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Status filter
    switch (filterStatus) {
      case 'unassigned':
        return !delivery.driverId;
      case 'assigned':
        return delivery.driverId && delivery.status === 'ASSIGNED';
      case 'in_progress':
        return delivery.driverId && ['EN_ROUTE_TO_CLIENT', 'ARRIVED_TO_CLIENT'].includes(delivery.status);
      default:
        return true;
    }
  });

  // Get available drivers (on duty and not overloaded)
  const availableDrivers = drivers.filter(driver => 
    driver.isOnDuty && (driver.activeDeliveries || 0) < 3 // Max 3 deliveries per driver
  );

  // Handle delivery assignment
  const handleAssignDelivery = async (deliveryId: string, driverId: string) => {
    if (!deliveryId || !driverId) return;

    setAssignmentLoading(true);
    try {
      const result = await assignDeliveryToDriver(deliveryId, driverId);
      
      if (result.success) {
        setSelectedDelivery(null);
        // Show success notification
              } else {
        console.error('Failed to assign delivery:', result.error);
      }
    } catch (error) {
      console.error('Error assigning delivery:', error);
    } finally {
      setAssignmentLoading(false);
    }
  };

  // Get delivery priority based on estimated arrival
  const getDeliveryPriority = (delivery: DeliveryTracking): 'high' | 'medium' | 'low' => {
    if (!delivery.estimatedArrival) return 'low';
    
    const now = new Date();
    const estimatedTime = new Date(delivery.estimatedArrival);
    const hoursUntilDelivery = (estimatedTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilDelivery <= 1) return 'high';
    if (hoursUntilDelivery <= 4) return 'medium';
    return 'low';
  };

  // Format address for display
  const formatLocation = (location: { coordinates: [number, number] }) => {
    // In a real implementation, you'd reverse geocode these coordinates
    return `${location.coordinates[1].toFixed(4)}, ${location.coordinates[0].toFixed(4)}`;
  };

  const DeliveryCard = ({ delivery }: { delivery: DeliveryTracking }) => {
    const priority = getDeliveryPriority(delivery);
    const assignedDriver = drivers.find(d => d.id === delivery.driverId);
    const isSelected = selectedDelivery === delivery.id;

    return (
      <Card className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md',
        isSelected && 'ring-2 ring-blue-500',
        {
          'border-red-200 bg-red-50': priority === 'high',
          'border-yellow-200 bg-yellow-50': priority === 'medium',
          'border-green-200 bg-green-50': delivery.driverId,
        }
      )} onClick={() => setSelectedDelivery(isSelected ? null : delivery.id)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            {/* Delivery info */}
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h4 className="font-medium">#{delivery.id.slice(-6)}</h4>
                
                {/* Priority badge */}
                <Badge variant={priority === 'high' ? 'destructive' : priority === 'medium' ? 'default' : 'secondary'}>
                  {priority} priority
                </Badge>
                
                {/* Status badge */}
                <Badge variant="outline">
                  {delivery.status}
                </Badge>
              </div>

              {/* Order type */}
              <div className="text-sm text-muted-foreground mb-2">
                {delivery.cateringRequestId && 'Catering Order'}
                {delivery.onDemandId && 'On-Demand Order'}
              </div>

              {/* Locations */}
              <div className="space-y-1 text-sm">
                <div className="flex items-center space-x-2">
                  <MapPinIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-muted-foreground">Pickup:</span>
                  <span>{formatLocation(delivery.pickupLocation)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPinIcon className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">Delivery:</span>
                  <span>{formatLocation(delivery.deliveryLocation)}</span>
                </div>
              </div>

              {/* Timing */}
              {delivery.estimatedArrival && (
                <div className="flex items-center space-x-2 text-sm mt-2">
                  <ClockIcon className="w-4 h-4 text-orange-500" />
                  <span className="text-muted-foreground">ETA:</span>
                  <span>{new Date(delivery.estimatedArrival).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Assignment status */}
            <div className="flex flex-col items-end space-y-2">
              {assignedDriver ? (
                <div className="text-right">
                  <div className="flex items-center space-x-1 text-sm text-green-700">
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Assigned</span>
                  </div>
                  <div className="text-sm font-medium">Driver #{assignedDriver.employeeId}</div>
                  <div className="text-xs text-muted-foreground">{assignedDriver.vehicleNumber}</div>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-sm text-red-600">
                  <AlertTriangleIcon className="w-4 h-4" />
                  <span>Unassigned</span>
                </div>
              )}
            </div>
          </div>

          {/* Assignment panel */}
          {isSelected && (
            <div className="mt-4 pt-4 border-t">
              {assignedDriver ? (
                <div className="space-y-3">
                  <h5 className="font-medium">Current Assignment</h5>
                  <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium">Driver #{assignedDriver.employeeId}</div>
                        <div className="text-sm text-muted-foreground">
                          {assignedDriver.vehicleNumber} • {assignedDriver.activeDeliveries || 0} active deliveries
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAssignDelivery(delivery.id, '')}
                      disabled={assignmentLoading}
                    >
                      Unassign
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <h5 className="font-medium">Assign to Driver</h5>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableDrivers.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <XCircleIcon className="w-8 h-8 mx-auto mb-2" />
                        <p>No available drivers</p>
                      </div>
                    ) : (
                      availableDrivers.map(driver => (
                        <div
                          key={driver.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleAssignDelivery(delivery.id, driver.id)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                              <UserIcon className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="font-medium">Driver #{driver.employeeId}</div>
                              <div className="text-sm text-muted-foreground">
                                {driver.vehicleNumber} • {driver.activeDeliveries || 0} active • 
                                {Math.round((driver.totalDistanceKm || 0) * 10) / 10} km today
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={assignmentLoading}
                          >
                            <PlusIcon className="w-4 h-4 mr-1" />
                            Assign
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Filters and search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search deliveries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="all">All Deliveries</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
        </select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-bold">{deliveries.length}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-bold text-red-600">
              {deliveries.filter(d => !d.driverId).length}
            </div>
            <div className="text-sm text-muted-foreground">Unassigned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-bold text-blue-600">
              {deliveries.filter(d => d.driverId && d.status === 'ASSIGNED').length}
            </div>
            <div className="text-sm text-muted-foreground">Assigned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-2xl font-bold text-green-600">
              {deliveries.filter(d => ['EN_ROUTE_TO_CLIENT', 'ARRIVED_TO_CLIENT'].includes(d.status)).length}
            </div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery list */}
      <div className="space-y-3">
        {filteredDeliveries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TruckIcon className="w-12 h-12 mx-auto mb-2" />
            <p>No deliveries match your criteria</p>
          </div>
        ) : (
          filteredDeliveries.map(delivery => (
            <DeliveryCard key={delivery.id} delivery={delivery} />
          ))
        )}
      </div>

      {/* Available drivers summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Available Drivers ({availableDrivers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableDrivers.map(driver => (
              <div key={driver.id} className="flex items-center space-x-3 p-2 border rounded">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">#{driver.employeeId}</div>
                  <div className="text-xs text-muted-foreground">
                    {driver.activeDeliveries || 0}/3 deliveries
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Available
                </Badge>
              </div>
            ))}
          </div>
          
          {availableDrivers.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <AlertTriangleIcon className="w-8 h-8 mx-auto mb-2" />
              <p>No drivers available for assignment</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
