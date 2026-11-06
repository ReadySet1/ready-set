import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouteBuilder } from '../RouteBuilder';
import type { Address } from '@/types/address';

const CURRENT_USER = 'current-user';

const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();
const mockRefetch = jest.fn();

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { id: 'current-user' } }),
}));

jest.mock('@/hooks/useAddresses', () => ({
  useAddresses: () => ({
    data: { addresses: [], pagination: undefined },
    isLoading: false,
    refetch: mockRefetch,
  }),
  useCreateAddress: () => ({ mutateAsync: mockCreateMutateAsync, isPending: false }),
  useUpdateAddress: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
}));

jest.mock('@/hooks/useAddressFavorites', () => ({
  useAddressFavorites: () => ({ favoriteIds: [], toggleFavorite: jest.fn(), isLoading: false }),
}));

jest.mock('@/hooks/useAddressRecents', () => ({
  useAddressRecents: () => ({ recents: [], recentIds: [], isLoading: false }),
}));

jest.mock('../MiniMap', () => ({
  MiniMap: () => <div data-testid="mini-map" />,
}));

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { value: jest.fn(), writable: true });
Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { value: jest.fn(), writable: true });
Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { value: jest.fn(), writable: true });

const baseAddress: Address = {
  id: 'pickup-1',
  county: 'San Francisco',
  name: null,
  street1: '123 Mian St',
  street2: null,
  city: 'San Francisco',
  state: 'CA',
  zip: '94103',
  locationNumber: null,
  parkingLoading: null,
  isRestaurant: true,
  isShared: false,
  latitude: 37.77,
  longitude: -122.41,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: CURRENT_USER,
};

const delivery: Address = {
  ...baseAddress,
  id: 'delivery-1',
  street1: '1 Market St',
  isRestaurant: false,
};

function renderBuilder(pickup: Address) {
  const onChange = jest.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouteBuilder pickup={pickup} delivery={delivery} onChange={onChange} />
    </QueryClientProvider>,
  );
  return { onChange };
}

// RouteBar renders desktop and mobile layouts; both are in the jsdom tree.
const firstButton = (name: RegExp) => screen.getAllByRole('button', { name })[0]!;

describe('RouteBuilder — editing a selected address in place', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates an address the user owns and keeps it in the slot', async () => {
    const corrected = { ...baseAddress, street1: '123 Main St' };
    mockUpdateMutateAsync.mockResolvedValue(corrected);
    const { onChange } = renderBuilder(baseAddress);

    await userEvent.click(firstButton(/^Edit pickup address$/i));

    const street = await screen.findByRole('textbox', { name: /Street Address \*/i });
    expect(street).toHaveValue('123 Mian St');

    await userEvent.clear(street);
    await userEvent.type(street, '123 Main St');
    await userEvent.click(screen.getByRole('button', { name: /^update$/i }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pickup-1',
          data: expect.objectContaining({ street1: '123 Main St' }),
        }),
      );
    });
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({ pickup: corrected, delivery });
  });

  it('saves a corrected copy when the address belongs to someone else', async () => {
    const shared = { ...baseAddress, isShared: true, createdBy: 'someone-else' };
    const copy = { ...shared, id: 'copy-1', street1: '123 Main St', isShared: false, createdBy: CURRENT_USER };
    mockCreateMutateAsync.mockResolvedValue(copy);
    const { onChange } = renderBuilder(shared);

    await userEvent.click(firstButton(/^Edit pickup address$/i));

    expect(await screen.findByText(/saved as a new private address/i)).toBeInTheDocument();
    const street = screen.getByRole('textbox', { name: /Street Address \*/i });
    expect(street).toHaveValue('123 Mian St');

    await userEvent.clear(street);
    await userEvent.type(street, '123 Main St');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ street1: '123 Main St', isShared: false }),
      );
    });
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({ pickup: copy, delivery });
  });

  it('still lets the user pick a different saved address', async () => {
    renderBuilder(baseAddress);
    expect(document.querySelector('[aria-current="location"]')).toBeNull();

    await userEvent.click(firstButton(/^Change pickup address$/i));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current="location"]')).not.toBeNull();
  });
});
