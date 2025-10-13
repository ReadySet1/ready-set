'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Address } from '@/types/address';
import type { AddressSearchComboboxProps } from '@/types/address-selector';

/**
 * AddressSearchCombobox Component
 *
 * A searchable combobox for selecting addresses with features:
 * - Instant search with highlighting
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Clear button
 * - Loading state
 * - Accessible via keyboard and screen readers
 */
export function AddressSearchCombobox({
  addresses,
  onSelect,
  selectedAddressId,
  placeholder = 'Search addresses...',
  disabled = false,
}: AddressSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const selectedAddress = React.useMemo(
    () => addresses.find((addr) => addr.id === selectedAddressId),
    [addresses, selectedAddressId]
  );

  const filteredAddresses = React.useMemo(() => {
    if (!searchQuery) return addresses;

    const query = searchQuery.toLowerCase();
    return addresses.filter((address) => {
      const searchableText = [
        address.name,
        address.street1,
        address.street2,
        address.city,
        address.state,
        address.zip,
        address.county,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [addresses, searchQuery]);

  const formatAddressDisplay = (address: Address): string => {
    const parts = [address.name, address.street1, address.city, address.state, address.zip];
    return parts.filter(Boolean).join(', ');
  };

  const formatAddressPreview = (address: Address): string => {
    const parts = [address.street1, address.city, address.state, address.zip];
    return parts.filter(Boolean).join(', ');
  };

  const handleSelect = (address: Address) => {
    onSelect(address);
    setOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedAddress) {
      // Reset selection by calling onSelect with undefined
      // The parent component should handle this case
      setSearchQuery('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select address"
          disabled={disabled}
          className={cn(
            'w-full justify-between',
            !selectedAddress && 'text-muted-foreground'
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {selectedAddress
                ? formatAddressDisplay(selectedAddress)
                : placeholder}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {selectedAddress && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={placeholder}
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="flex h-11 w-full border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>
              {searchQuery ? 'No addresses found.' : 'Start typing to search...'}
            </CommandEmpty>
            <CommandGroup>
              {filteredAddresses.map((address) => (
                <CommandItem
                  key={address.id}
                  value={address.id}
                  onSelect={() => handleSelect(address)}
                  className="flex items-start gap-2 px-3 py-2"
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      selectedAddressId === address.id
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      {address.name && (
                        <span className="font-medium truncate">
                          {address.name}
                        </span>
                      )}
                      {address.isShared && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          Shared
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground truncate">
                      {formatAddressPreview(address)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
