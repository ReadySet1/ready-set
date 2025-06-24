interface Coordinate {
  latitude: number;
  longitude: number;
}

export function getCenterCoordinate(coordinates: Coordinate[]): Coordinate {
  if (coordinates.length === 0) {
    throw new Error('No coordinates provided');
  }
  
  const sum = coordinates.reduce(
    (acc, coord) => ({
      latitude: acc.latitude + coord.latitude,
      longitude: acc.longitude + coord.longitude
    }),
    { latitude: 0, longitude: 0 }
  );
  
  return {
    latitude: sum.latitude / coordinates.length,
    longitude: sum.longitude / coordinates.length
  };
}

export function calculateDistance(
  coord1: Coordinate, 
  coord2: Coordinate
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.latitude * Math.PI / 180) * 
    Math.cos(coord2.latitude * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
} 