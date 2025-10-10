"use client";

import { useCallback } from 'react';

interface UmamiEventData {
  [key: string]: string | number | boolean;
}

export const useUmami = () => {
  const trackEvent = useCallback((eventName: string, eventData?: UmamiEventData) => {
    try {
      if (typeof window !== 'undefined' && window.umami) {
        window.umami.track(eventName, eventData);
        console.log('🎯 Umami event tracked:', eventName, eventData);
      } else {
        console.warn('⚠️ Umami not available for tracking event:', eventName);
      }
    } catch (error) {
      console.error('❌ Error tracking Umami event:', error);
    }
  }, []);

  const trackPageView = useCallback((url?: string) => {
    try {
      if (typeof window !== 'undefined' && window.umami) {
        // Umami automatically tracks page views, but you can manually track specific ones
        window.umami.track('pageview', { url: url || window.location.pathname });
        console.log('📊 Umami page view tracked:', url || window.location.pathname);
      }
    } catch (error) {
      console.error('❌ Error tracking Umami page view:', error);
    }
  }, []);

  return {
    trackEvent,
    trackPageView
  };
}; 