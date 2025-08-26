import { UserType } from '@/types/user';
import {
  getDashboardRouteByRole,
  shouldRedirectToClientDashboard,
  getOrderCreationRedirectRoute,
} from '../routing';

describe('Routing Utilities', () => {
  describe('getDashboardRouteByRole', () => {
    it('returns /client for CLIENT role', () => {
      expect(getDashboardRouteByRole(UserType.CLIENT)).toBe('/client');
    });

    it('returns /vendor for VENDOR role', () => {
      expect(getDashboardRouteByRole(UserType.VENDOR)).toBe('/vendor');
    });

    it('returns /driver for DRIVER role', () => {
      expect(getDashboardRouteByRole(UserType.DRIVER)).toBe('/driver');
    });

    it('returns /admin for ADMIN role', () => {
      expect(getDashboardRouteByRole(UserType.ADMIN)).toBe('/admin');
    });

    it('returns /admin for SUPER_ADMIN role', () => {
      expect(getDashboardRouteByRole(UserType.SUPER_ADMIN)).toBe('/admin');
    });

    it('returns /helpdesk for HELPDESK role', () => {
      expect(getDashboardRouteByRole(UserType.HELPDESK)).toBe('/helpdesk');
    });

    it('returns / for null role', () => {
      expect(getDashboardRouteByRole(null)).toBe('/');
    });

    it('returns / for undefined role', () => {
      expect(getDashboardRouteByRole(undefined as any)).toBe('/');
    });
  });

  describe('shouldRedirectToClientDashboard', () => {
    it('returns true for CLIENT role', () => {
      expect(shouldRedirectToClientDashboard(UserType.CLIENT)).toBe(true);
    });

    it('returns false for VENDOR role', () => {
      expect(shouldRedirectToClientDashboard(UserType.VENDOR)).toBe(false);
    });

    it('returns false for DRIVER role', () => {
      expect(shouldRedirectToClientDashboard(UserType.DRIVER)).toBe(false);
    });

    it('returns false for ADMIN role', () => {
      expect(shouldRedirectToClientDashboard(UserType.ADMIN)).toBe(false);
    });

    it('returns false for SUPER_ADMIN role', () => {
      expect(shouldRedirectToClientDashboard(UserType.SUPER_ADMIN)).toBe(false);
    });

    it('returns false for HELPDESK role', () => {
      expect(shouldRedirectToClientDashboard(UserType.HELPDESK)).toBe(false);
    });

    it('returns false for null role', () => {
      expect(shouldRedirectToClientDashboard(null)).toBe(false);
    });
  });

  describe('getOrderCreationRedirectRoute', () => {
    it('returns /client for CLIENT role', () => {
      expect(getOrderCreationRedirectRoute(UserType.CLIENT)).toBe('/client');
    });

    it('returns /vendor for VENDOR role', () => {
      expect(getOrderCreationRedirectRoute(UserType.VENDOR)).toBe('/vendor');
    });

    it('returns /driver for DRIVER role', () => {
      expect(getOrderCreationRedirectRoute(UserType.DRIVER)).toBe('/driver');
    });

    it('returns /admin for ADMIN role', () => {
      expect(getOrderCreationRedirectRoute(UserType.ADMIN)).toBe('/admin');
    });

    it('returns /admin for SUPER_ADMIN role', () => {
      expect(getOrderCreationRedirectRoute(UserType.SUPER_ADMIN)).toBe('/admin');
    });

    it('returns /helpdesk for HELPDESK role', () => {
      expect(getOrderCreationRedirectRoute(UserType.HELPDESK)).toBe('/helpdesk');
    });

    it('returns / for null role', () => {
      expect(getOrderCreationRedirectRoute(null)).toBe('/');
    });
  });
});
