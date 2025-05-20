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
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <>
      {metricoolHash && <MetricoolScript trackingHash={metricoolHash} />}
      {gaMeasurementId && <GoogleAnalytics gaId={gaMeasurementId} />}

      {isVisible && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 md:p-6 z-50">
          <div className="max-w-7xl mx-auto relative">
            <button 
              onClick={handleClose}
              className="absolute -top-2 right-2 md:right-0 text-gray-500 hover:text-gray-700 p-2" 
              aria-label="Close banner"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col gap-4">
              <div className="pr-8">
                <p className="text-sm md:text-base text-gray-600">
                  We use cookies to enhance your experience, serve personalized ads or content, and analyze traffic. 
                  Under the California Consumer Privacy Act (CCPA) and other U.S. privacy laws, you have the right to manage your cookie preferences. 
                  By clicking &quot;Accept All,&quot; you consent to our use of cookies. To learn more, read our{' '}
                  <Link href="https://support.google.com/analytics/answer/6004245?hl=en" className="text-blue-600 hover:text-blue-800 underline">
                    Cookie Policy
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy-policy" className="text-blue-600 hover:text-blue-800 underline">
                    Privacy Policy
                  </Link>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  onClick={handleAcceptAll}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md text-sm font-medium transition-colors"
                >
                  Accept All
                </button>
                <button
                  onClick={handlePreferences}
                  className="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 text-white px-6 py-2.5 rounded-md text-sm font-medium transition-colors"
                >
                  Manage Preferences
                </button>
                <button
                  onClick={handleRejectAll}
                  className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white px-6 py-2.5 rounded-md text-sm font-medium transition-colors"
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