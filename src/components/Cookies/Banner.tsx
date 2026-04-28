"use client";

import Link from 'next/link'
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { GoogleAnalytics } from "@next/third-parties/google";
import CookiePreferencesModal from './CookiePreferencesModal';
import MetricoolScript from '@/components/Analytics/MetriCool';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
}

interface CookieConsentBannerProps {
  metricoolHash: string;
  gaMeasurementId: string;
}

const CookieConsentBanner = ({ metricoolHash, gaMeasurementId }: CookieConsentBannerProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [consentGiven, setConsentGiven] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    personalization: false
  });

  useEffect(() => {
    const consentStatus = localStorage.getItem('cookieConsentStatus');
    if (!consentStatus) {
      setIsVisible(true);
    } else {
      try {
        const savedPreferences = JSON.parse(localStorage.getItem('cookiePreferences') || '{}');
        setConsentGiven(savedPreferences);
        
        if (window && gaMeasurementId) {
          window[`ga-disable-${gaMeasurementId}`] = !(savedPreferences.analytics || savedPreferences.marketing);
        }
      } catch (error) {
        console.error('Error parsing cookie preferences:', error);
      }
    }
  }, [gaMeasurementId]);

  const handleAcceptAll = () => {
    const preferences: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true
    };
    localStorage.setItem('cookieConsentStatus', 'accepted');
    localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
    
    if (window && gaMeasurementId) {
      window[`ga-disable-${gaMeasurementId}`] = false;
    }
    
    setConsentGiven(preferences);
    setIsVisible(false);
    
    // Dispatch custom event to notify other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cookiePreferencesUpdated'));
    }
  };

  const handleRejectAll = () => {
    const preferences: CookiePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      personalization: false
    };
    localStorage.setItem('cookieConsentStatus', 'rejected');
    localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
    
    if (window && gaMeasurementId) {
      window[`ga-disable-${gaMeasurementId}`] = true;
      document.cookie = '_ga=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = '_gat=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = '_gid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
    
    setConsentGiven(preferences);
    setIsVisible(false);
    
    // Dispatch custom event to notify other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cookiePreferencesUpdated'));
    }
  };

  const handlePreferences = () => {
    setIsPreferencesModalOpen(true);
  };

  const handlePreferencesSave = (preferences: CookiePreferences) => {
    localStorage.setItem('cookieConsentStatus', 'preferences');
    localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
    
    if (window && gaMeasurementId) {
      window[`ga-disable-${gaMeasurementId}`] = !(preferences.analytics || preferences.marketing);
      
      if (!preferences.analytics && !preferences.marketing) {
        document.cookie = '_ga=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = '_gat=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = '_gid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      }
    }
    
    setConsentGiven(preferences);
    setIsVisible(false);
    
    // Dispatch custom event to notify other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cookiePreferencesUpdated'));
    }
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <>
      {metricoolHash && <MetricoolScript trackingHash={metricoolHash} />}
      {gaMeasurementId && <GoogleAnalytics gaId={gaMeasurementId} />}

      {isVisible && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 shadow-lg p-3 md:p-4 z-50">
          <div className="max-w-7xl mx-auto relative">
            <button
              onClick={handleClose}
              className="absolute -top-1 right-2 md:right-0 text-gray-500 hover:text-gray-700 p-2"
              aria-label="Close banner"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="pr-8 md:flex-1">
                <p className="text-sm text-gray-600">
                  We use cookies to improve your experience and analyze traffic.
                  See our{' '}
                  <Link href="/privacy-policy" className="text-blue-600 hover:text-blue-800 underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:flex-shrink-0">
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  aria-label="Accept all cookies"
                  data-testid="cookie-accept-all"
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Accept All
                </button>
                <button
                  type="button"
                  onClick={handlePreferences}
                  aria-label="Manage cookie preferences"
                  data-testid="cookie-manage-preferences"
                  className="w-full sm:w-auto border border-gray-300 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Manage
                </button>
                <button
                  type="button"
                  onClick={handleRejectAll}
                  aria-label="Reject all cookies"
                  data-testid="cookie-reject-all"
                  className="w-full sm:w-auto border border-gray-300 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Reject All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CookiePreferencesModal 
        isOpen={isPreferencesModalOpen}
        onClose={() => setIsPreferencesModalOpen(false)}
        onSave={handlePreferencesSave}
      />
    </>
  );
};

export default CookieConsentBanner;