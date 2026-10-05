import React from 'react';
import { render, screen } from '@testing-library/react';

// jest.setup.ts sets NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN, so the component takes
// the "token present" path and tries to create the map.
const mockMapInstance = {
  addControl: jest.fn(),
  on: jest.fn(),
  remove: jest.fn(),
};

jest.mock('mapbox-gl', () => ({
  Map: jest.fn(() => mockMapInstance),
  Marker: jest.fn(),
  Popup: jest.fn(),
  NavigationControl: jest.fn(),
  ScaleControl: jest.fn(),
  LngLatBounds: jest.fn(),
  supported: jest.fn(() => true),
  accessToken: '',
}));

jest.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));

import mapboxgl from 'mapbox-gl';
import MileageMap from '../MileageMap';

const MockMap = mapboxgl.Map as unknown as jest.Mock;
const mockSupported = mapboxgl.supported as unknown as jest.Mock;

describe('MileageMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockMap.mockImplementation(() => mockMapInstance);
    mockSupported.mockReturnValue(true);
  });

  it('creates the map when WebGL is supported', () => {
    render(<MileageMap calculation={null} />);

    expect(MockMap).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Map unavailable/)).not.toBeInTheDocument();
  });

  it('renders the fallback without creating the map when WebGL is not supported', () => {
    mockSupported.mockReturnValue(false);

    expect(() => render(<MileageMap calculation={null} />)).not.toThrow();

    expect(MockMap).not.toHaveBeenCalled();
    expect(screen.getByText(/Map unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/WebGL/)).toBeInTheDocument();
  });

  it('renders the fallback when the map constructor throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    MockMap.mockImplementation(() => {
      throw new Error('Failed to initialize WebGL');
    });

    expect(() => render(<MileageMap calculation={null} />)).not.toThrow();

    expect(screen.getByText(/Map unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/WebGL/)).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
