import { renderHook, act, waitFor } from '@testing-library/react';
import { useAddressSearch } from '../useAddressSearch';
import type { Address } from '@/types/address';

// Mock useDebounce to return the value immediately for testing
jest.mock('../useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

const mockAddresses: Address[] = [
  {
    id: '1',
    name: 'Kasa Indian Eatery',
    street1: '4420 Barranca Pkwy',
    street2: '',
    city: 'Irvine',
    state: 'CA',
    zip: '92604',
    county: 'Orange',
    isShared: true,
    phoneNumber: '949-123-4567',
  },
  {
    id: '2',
    name: 'The Habit Burger',
    street1: '123 Main St',
    street2: 'Suite 200',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
    county: 'Los Angeles',
    isShared: true,
    phoneNumber: '310-555-1234',
  },
  {
    id: '3',
    name: 'Private Home',
    street1: '789 Private Ln',
    street2: '',
    city: 'San Diego',
    state: 'CA',
    zip: '92101',
    county: 'San Diego',
    isShared: false,
    phoneNumber: '619-555-9999',
  },
];

describe('useAddressSearch', () => {
  describe('Initial State', () => {
    it('returns all addresses when no filters applied', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      expect(result.current.filteredAddresses).toHaveLength(3);
      expect(result.current.resultCount).toBe(3);
      expect(result.current.isSearching).toBe(false);
    });

    it('initializes with provided filter', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
          initialFilter: 'shared',
        })
      );

      expect(result.current.filters.filter).toBe('shared');
      expect(result.current.filteredAddresses).toHaveLength(2);
    });
  });

  describe('Text Search', () => {
    it('filters addresses by name', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setQuery('Kasa');
      });

      expect(result.current.filteredAddresses).toHaveLength(1);
      expect(result.current.filteredAddresses[0].name).toBe('Kasa Indian Eatery');
      expect(result.current.isSearching).toBe(true);
    });

    it('filters addresses by street', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setQuery('Barranca');
      });

      expect(result.current.filteredAddresses).toHaveLength(1);
      expect(result.current.filteredAddresses[0].name).toBe('Kasa Indian Eatery');
    });

    it('filters addresses by city', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setQuery('Irvine');
      });

      expect(result.current.filteredAddresses).toHaveLength(1);
      expect(result.current.filteredAddresses[0].city).toBe('Irvine');
    });

    it('filters addresses by county', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setQuery('Orange');
      });

      expect(result.current.filteredAddresses).toHaveLength(1);
      expect(result.current.filteredAddresses[0].county).toBe('Orange');
    });

    it('is case-insensitive', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setQuery('KASA');
      });

      expect(result.current.filteredAddresses).toHaveLength(1);
      expect(result.current.filteredAddresses[0].name).toBe('Kasa Indian Eatery');
    });

    it('returns empty array when no matches', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setQuery('NonExistent Address');
      });

      expect(result.current.filteredAddresses).toHaveLength(0);
      expect(result.current.resultCount).toBe(0);
    });
  });

  describe('Filter Functionality', () => {
    it('filters to show only shared addresses', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setFilters({ query: '', filter: 'shared' });
      });

      expect(result.current.filteredAddresses).toHaveLength(2);
      expect(result.current.filteredAddresses.every((a) => a.isShared)).toBe(true);
    });

    it('filters to show only private addresses', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setFilters({ query: '', filter: 'private' });
      });

      expect(result.current.filteredAddresses).toHaveLength(1);
      expect(result.current.filteredAddresses.every((a) => !a.isShared)).toBe(true);
    });

    it('combines search and filter', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setQuery('Los Angeles');
        result.current.setFilters({ query: '', filter: 'shared' });
      });

      expect(result.current.filteredAddresses).toHaveLength(1);
      expect(result.current.filteredAddresses[0].name).toBe('The Habit Burger');
    });
  });

  describe('Favorites', () => {
    it('marks addresses as favorites', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
          favorites: ['1', '2'],
        })
      );

      const favorites = result.current.favoriteAddresses;
      expect(favorites).toHaveLength(2);
      expect(favorites.every((a) => a.isFavorite)).toBe(true);
    });

    it('returns empty favorites when none set', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
          favorites: [],
        })
      );

      expect(result.current.favoriteAddresses).toHaveLength(0);
    });

    it('filters favorites with search query', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
          favorites: ['1', '2'],
        })
      );

      act(() => {
        result.current.setQuery('Kasa');
      });

      expect(result.current.favoriteAddresses).toHaveLength(1);
      expect(result.current.favoriteAddresses[0].name).toBe('Kasa Indian Eatery');
    });
  });

  describe('Recents', () => {
    it('marks addresses as recent and sorts by lastUsedAt', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
          recents: [
            { addressId: '1', lastUsedAt: yesterday },
            { addressId: '2', lastUsedAt: now },
          ],
        })
      );

      const recents = result.current.recentAddresses;
      expect(recents).toHaveLength(2);
      // Most recent should be first
      expect(recents[0].id).toBe('2');
      expect(recents[1].id).toBe('1');
    });

    it('limits recents to 5 addresses', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: Array(10)
            .fill(null)
            .map((_, i) => ({
              ...mockAddresses[0],
              id: `${i}`,
            })),
          recents: Array(10)
            .fill(null)
            .map((_, i) => ({
              addressId: `${i}`,
              lastUsedAt: new Date(),
            })),
        })
      );

      expect(result.current.recentAddresses).toHaveLength(5);
    });

    it('filters recents with search query', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
          recents: [
            { addressId: '1', lastUsedAt: new Date() },
            { addressId: '2', lastUsedAt: new Date() },
          ],
        })
      );

      act(() => {
        result.current.setQuery('Habit');
      });

      expect(result.current.recentAddresses).toHaveLength(1);
      expect(result.current.recentAddresses[0].name).toBe('The Habit Burger');
    });
  });

  describe('Helper Functions', () => {
    it('addressMatchesQuery returns true for matching addresses', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      const matches = result.current.addressMatchesQuery(mockAddresses[0], 'Kasa');
      expect(matches).toBe(true);
    });

    it('addressMatchesQuery returns false for non-matching addresses', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      const matches = result.current.addressMatchesQuery(mockAddresses[0], 'NonExistent');
      expect(matches).toBe(false);
    });

    it('addressMatchesQuery returns true for empty query', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      const matches = result.current.addressMatchesQuery(mockAddresses[0], '');
      expect(matches).toBe(true);
    });
  });

  describe('City and County Filters', () => {
    it('filters by city', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setFilters({ query: '', filter: 'all', city: 'Irvine' });
      });

      expect(result.current.filteredAddresses).toHaveLength(1);
      expect(result.current.filteredAddresses[0].city).toBe('Irvine');
    });

    it('filters by county', () => {
      const { result } = renderHook(() =>
        useAddressSearch({
          addresses: mockAddresses,
        })
      );

      act(() => {
        result.current.setFilters({ query: '', filter: 'all', county: 'Orange' });
      });

      expect(result.current.filteredAddresses).toHaveLength(1);
      expect(result.current.filteredAddresses[0].county).toBe('Orange');
    });
  });
});
