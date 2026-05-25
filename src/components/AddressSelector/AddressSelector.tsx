'use client';

import type { Address } from '@/types/address';
import type { AddressSelectorProps, RouteBuilderProps } from '@/types/address-selector';
import { RouteBuilder } from './RouteBuilder';
import { AddressSelectorLegacy } from './AddressSelectorLegacy';

/**
 * Route Builder props shape (new API).
 * Uses pickup/delivery/onChange pattern.
 */
interface RouteBuilderAdapterProps {
  pickup: Address | null;
  delivery: Address | null;
  onChange: (value: { pickup: Address | null; delivery: Address | null }) => void;
  onCreateNew?: () => void;
  mode?: 'client' | 'admin';
  className?: string;
  isLoading?: boolean;
}

type CombinedProps = AddressSelectorProps | RouteBuilderAdapterProps;

function isRouteBuilderProps(props: CombinedProps): props is RouteBuilderAdapterProps {
  return 'onChange' in props && 'pickup' in props;
}

/**
 * AddressSelector — unified entry point.
 *
 * New API (Route Builder): pass `pickup`, `delivery`, `onChange`
 * Legacy API: pass `mode`, `onSelect`, `type`
 */
export function AddressSelector(props: CombinedProps) {
  if (isRouteBuilderProps(props)) {
    return (
      <RouteBuilder
        pickup={props.pickup}
        delivery={props.delivery}
        onChange={props.onChange}
        onCreateNew={props.onCreateNew}
        mode={props.mode}
        className={props.className}
        isLoading={props.isLoading}
      />
    );
  }

  return <AddressSelectorLegacy {...props} />;
}
