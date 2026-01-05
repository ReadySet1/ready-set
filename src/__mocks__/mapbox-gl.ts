/**
 * Manual mock for Mapbox GL JS
 * This prevents actual map rendering during tests
 *
 * The mock provides:
 * - Event listener support (on/off) with ability to trigger events
 * - Fresh instances for each Map/Marker/Popup creation
 * - Full method chaining support
 */

// Factory function to create a fresh marker instance
const createMockMarker = () => {
  const marker: any = {
    setLngLat: jest.fn().mockImplementation(function(this: any) { return this; }),
    setPopup: jest.fn().mockImplementation(function(this: any) { return this; }),
    addTo: jest.fn().mockImplementation(function(this: any) { return this; }),
    remove: jest.fn(),
    getElement: jest.fn().mockReturnValue(document.createElement('div')),
    getLngLat: jest.fn().mockReturnValue({ lng: 0, lat: 0 }),
    getPopup: jest.fn().mockImplementation(() => createMockPopup()),
  };
  return marker;
};

// Factory function to create a fresh popup instance
const createMockPopup = () => {
  const popup: any = {
    setHTML: jest.fn().mockImplementation(function(this: any) { return this; }),
    setMaxWidth: jest.fn().mockImplementation(function(this: any) { return this; }),
    setLngLat: jest.fn().mockImplementation(function(this: any) { return this; }),
    addTo: jest.fn().mockImplementation(function(this: any) { return this; }),
    remove: jest.fn(),
    isOpen: jest.fn().mockReturnValue(false),
  };
  return popup;
};

// Callback type for event listeners
type EventCallback = (...args: unknown[]) => void;

// Factory function to create a fresh map instance with event support
const createMockMap = () => {
  const eventListeners: Map<string, Set<EventCallback>> = new Map();

  const map: any = {
    // Event handling
    on: jest.fn().mockImplementation((event: string, callback: EventCallback) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set());
      }
      eventListeners.get(event)!.add(callback);
      return map;
    }),
    off: jest.fn().mockImplementation((event: string, callback: EventCallback) => {
      if (eventListeners.has(event)) {
        eventListeners.get(event)!.delete(callback);
      }
      return map;
    }),
    once: jest.fn().mockImplementation((event: string, callback: EventCallback) => {
      const wrappedCallback = (...args: unknown[]) => {
        callback(...args);
        map.off(event, wrappedCallback);
      };
      map.on(event, wrappedCallback);
      return map;
    }),

    // Helper to fire events (for tests)
    _fireEvent: (event: string, ...args: any[]) => {
      if (eventListeners.has(event)) {
        eventListeners.get(event)!.forEach(callback => callback(...args));
      }
    },
    _getEventListeners: () => eventListeners,

    // Map controls
    addControl: jest.fn().mockImplementation(function(this: any) { return this; }),
    removeControl: jest.fn().mockImplementation(function(this: any) { return this; }),

    // Map manipulation
    remove: jest.fn(),
    setStyle: jest.fn().mockImplementation(function(this: any) { return this; }),
    getStyle: jest.fn().mockReturnValue({ layers: [] }),

    // Zoom/Pan
    zoomIn: jest.fn().mockImplementation(function(this: any) { return this; }),
    zoomOut: jest.fn().mockImplementation(function(this: any) { return this; }),
    setZoom: jest.fn().mockImplementation(function(this: any) { return this; }),
    getZoom: jest.fn().mockReturnValue(10),
    setCenter: jest.fn().mockImplementation(function(this: any) { return this; }),
    getCenter: jest.fn().mockReturnValue({ lng: -122.4194, lat: 37.7749 }),
    panTo: jest.fn().mockImplementation(function(this: any) { return this; }),
    flyTo: jest.fn().mockImplementation(function(this: any) { return this; }),
    easeTo: jest.fn().mockImplementation(function(this: any) { return this; }),
    jumpTo: jest.fn().mockImplementation(function(this: any) { return this; }),
    fitBounds: jest.fn().mockImplementation(function(this: any) { return this; }),

    // Bounds
    getBounds: jest.fn().mockReturnValue({
      getNorthEast: () => ({ lng: 0, lat: 0 }),
      getSouthWest: () => ({ lng: 0, lat: 0 }),
      extend: jest.fn().mockReturnThis(),
    }),

    // Container
    getContainer: jest.fn().mockReturnValue(document.createElement('div')),
    getCanvasContainer: jest.fn().mockReturnValue(document.createElement('div')),
    getCanvas: jest.fn().mockReturnValue(document.createElement('canvas')),

    // Layers
    addLayer: jest.fn().mockImplementation(function(this: any) { return this; }),
    removeLayer: jest.fn().mockImplementation(function(this: any) { return this; }),
    getLayer: jest.fn().mockReturnValue(undefined),

    // Sources
    addSource: jest.fn().mockImplementation(function(this: any) { return this; }),
    removeSource: jest.fn().mockImplementation(function(this: any) { return this; }),
    getSource: jest.fn().mockReturnValue(undefined),

    // State
    loaded: jest.fn().mockReturnValue(true),
    isMoving: jest.fn().mockReturnValue(false),
    isZooming: jest.fn().mockReturnValue(false),
    isRotating: jest.fn().mockReturnValue(false),

    // Resize
    resize: jest.fn().mockImplementation(function(this: any) { return this; }),

    // Project
    project: jest.fn().mockReturnValue({ x: 0, y: 0 }),
    unproject: jest.fn().mockReturnValue({ lng: 0, lat: 0 }),
  };

  return map;
};

// Factory function for LngLatBounds
const createMockLngLatBounds = () => {
  const bounds: any = {
    extend: jest.fn().mockImplementation(function(this: any) { return this; }),
    isEmpty: jest.fn().mockReturnValue(false),
    getCenter: jest.fn().mockReturnValue({ lng: 0, lat: 0 }),
    getNorthEast: jest.fn().mockReturnValue({ lng: 0, lat: 0 }),
    getSouthWest: jest.fn().mockReturnValue({ lng: 0, lat: 0 }),
    toArray: jest.fn().mockReturnValue([[-180, -90], [180, 90]]),
  };
  return bounds;
};

// Create the mock object to be exported as default
const mapboxGlMock = {
  Map: jest.fn().mockImplementation(() => createMockMap()),
  Marker: jest.fn().mockImplementation(() => createMockMarker()),
  Popup: jest.fn().mockImplementation(() => createMockPopup()),
  NavigationControl: jest.fn().mockImplementation(() => ({
    onAdd: jest.fn().mockReturnValue(document.createElement('div')),
    onRemove: jest.fn(),
  })),
  ScaleControl: jest.fn().mockImplementation(() => ({
    onAdd: jest.fn().mockReturnValue(document.createElement('div')),
    onRemove: jest.fn(),
  })),
  LngLatBounds: jest.fn().mockImplementation(() => createMockLngLatBounds()),
  LngLat: jest.fn().mockImplementation((lng: number, lat: number) => ({ lng, lat })),
  accessToken: '',
  supported: jest.fn().mockReturnValue(true),
  setRTLTextPlugin: jest.fn(),
  getRTLTextPluginStatus: jest.fn().mockReturnValue('unavailable'),
};

// Export as default module
export default mapboxGlMock;

// Export factory functions for test assertions and custom setup
export { createMockMap, createMockMarker, createMockPopup, createMockLngLatBounds };
