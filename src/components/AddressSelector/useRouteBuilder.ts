'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Address } from '@/types/address';
import type { ActiveSlot } from '@/types/address-selector';

interface UseRouteBuilderOptions {
  pickup: Address | null;
  delivery: Address | null;
  onChange: (value: { pickup: Address | null; delivery: Address | null }) => void;
}

interface UseRouteBuilderReturn {
  activeSlot: ActiveSlot;
  assignAddress: (address: Address) => void;
  editSlot: (slot: 'pickup' | 'delivery') => void;
  clearSlot: (slot: 'pickup' | 'delivery') => void;
  clearActiveSlot: () => void;
}

export function useRouteBuilder({
  pickup,
  delivery,
  onChange,
}: UseRouteBuilderOptions): UseRouteBuilderReturn {
  // Determine initial active slot
  const getInitialSlot = (): ActiveSlot => {
    if (!pickup && !delivery) return 'pickup';
    if (pickup && !delivery) return 'delivery';
    return null;
  };

  const [activeSlot, setActiveSlot] = useState<ActiveSlot>(getInitialSlot);

  // Re-evaluate active slot when pickup/delivery change externally
  useEffect(() => {
    if (!pickup && !delivery && activeSlot === null) {
      setActiveSlot('pickup');
    }
  }, [pickup, delivery, activeSlot]);

  const assignAddress = useCallback(
    (address: Address) => {
      if (!activeSlot) return;

      const newPickup = activeSlot === 'pickup' ? address : pickup;
      const newDelivery = activeSlot === 'delivery' ? address : delivery;

      onChange({ pickup: newPickup, delivery: newDelivery });

      // Auto-advance: pickup → delivery → null
      if (activeSlot === 'pickup' && !delivery) {
        setActiveSlot('delivery');
      } else {
        setActiveSlot(null);
      }
    },
    [activeSlot, pickup, delivery, onChange],
  );

  const editSlot = useCallback((slot: 'pickup' | 'delivery') => {
    setActiveSlot(slot);
  }, []);

  const clearSlot = useCallback(
    (slot: 'pickup' | 'delivery') => {
      const newPickup = slot === 'pickup' ? null : pickup;
      const newDelivery = slot === 'delivery' ? null : delivery;
      onChange({ pickup: newPickup, delivery: newDelivery });
      setActiveSlot(slot);
    },
    [pickup, delivery, onChange],
  );

  const clearActiveSlot = useCallback(() => {
    if (pickup && delivery) {
      setActiveSlot(null);
    }
  }, [pickup, delivery]);

  // Keyboard: Esc clears active slot back to null if both are set
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pickup && delivery) {
        setActiveSlot(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pickup, delivery]);

  return {
    activeSlot,
    assignAddress,
    editSlot,
    clearSlot,
    clearActiveSlot,
  };
}
