import { useEffect, useLayoutEffect } from 'react';

/**
 * `useLayoutEffect` in the browser, `useEffect` during SSR.
 *
 * React warns when `useLayoutEffect` runs on the server; this keeps the
 * layout-phase timing on the client (needed when a ref must already be
 * up to date before any passive effect or external event can observe it)
 * without the server-side warning.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
