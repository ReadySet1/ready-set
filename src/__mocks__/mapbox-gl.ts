/**
 * Manual mock for Mapbox GL JS
 * This prevents actual map rendering during tests
 */

const mockMarker = {
  setLngLat: jest.fn().mockReturnThis(),
  setPopup: jest.fn().mockReturnThis(),
  addTo: jest.fn().mockReturnThis(),
  remove: jest.fn(),
  getPopup: jest.fn().mockReturnValue({
    setHTML: jest.fn().mockReturnThis(),
  }),
};

const mockPopup = {
  setHTML: jest.fn().mockReturnThis(),
  setMaxWidth: jest.fn().mockReturnThis(),
};

const mockMap = {
  addControl: jest.fn(),
  on: jest.fn(),
  remove: jest.fn(),
  setStyle: jest.fn(),
  zoomIn: jest.fn(),
  zoomOut: jest.fn(),
  fitBounds: jest.fn(),
  getZoom: jest.fn().mockReturnValue(10),
  getCenter: jest.fn().mockReturnValue({ lng: 0, lat: 0 }),
};

export default {
  Map: jest.fn().mockImplementation(() => mockMap),
  Marker: jest.fn().mockImplementation(() => mockMarker),
  Popup: jest.fn().mockImplementation(() => mockPopup),
  NavigationControl: jest.fn().mockImplementation(() => ({})),
  ScaleControl: jest.fn().mockImplementation(() => ({})),
  LngLatBounds: jest.fn().mockImplementation(() => ({
    extend: jest.fn().mockReturnThis(),
    isEmpty: jest.fn().mockReturnValue(false),
  })),
  accessToken: '',
};

const mapboxGlMock = {
  Map: jest.fn().mockImplementation(() => mockMap),
  Marker: jest.fn().mockImplementation(() => mockMarker),
  Popup: jest.fn().mockImplementation(() => mockPopup),
  NavigationControl: jest.fn().mockImplementation(() => ({})),
  ScaleControl: jest.fn().mockImplementation(() => ({})),
  LngLatBounds: jest.fn().mockImplementation(() => ({
    extend: jest.fn().mockReturnThis(),
    isEmpty: jest.fn().mockReturnValue(false),
  })),
  accessToken: '',
};

// Export as default module
export default mapboxGlMock;

// Export mocks for test assertions
export { mockMap, mockMarker, mockPopup };
