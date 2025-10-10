"use client";
import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSTANTS } from "@/constants";
declare global {
    interface Window {
        umami?: {
            track: (eventName: string, eventData?: Record<string, any>) => void;
        };
    }
}
interface TrackingPreferences {
    analytics?: boolean;
    marketing?: boolean;
}
export default function UmamiAnalytics() {
    const [shouldLoadScript, setShouldLoadScript] = useState(true); // Default to true since Umami is privacy-focused
    const checkConsentStatus = () => {
        try {
            const consentStatus = localStorage.getItem("cookieConsentStatus");
            const preferences: TrackingPreferences = JSON.parse(localStorage.getItem("cookiePreferences") || "{}");
            // Only block Umami if user explicitly rejected analytics
            // Since Umami is privacy-focused and doesn't use cookies, we load it by default
            if (consentStatus === "rejected" || preferences.analytics === false) {
                setShouldLoadScript(false);
            }
            else {
                setShouldLoadScript(true);
            }
        }
        catch (error) {
            console.error("Error parsing cookie preferences:", error);
            // Default to loading Umami since it's privacy-compliant
            setShouldLoadScript(true);
        }
    };
    useEffect(() => {
        checkConsentStatus();
        // Listen for cookie preference changes
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "cookiePreferences" || e.key === "cookieConsentStatus") {
                checkConsentStatus();
            }
        };
        // Listen for custom event when preferences are updated in the same tab
        const handlePreferencesUpdate = () => {
            checkConsentStatus();
        };
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('cookiePreferencesUpdated', handlePreferencesUpdate);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('cookiePreferencesUpdated', handlePreferencesUpdate);
        };
    }, []);
    return shouldLoadScript ? (<Script async src={`${CONSTANTS.UMAMI_HOST_URL}/script.js`} data-website-id={CONSTANTS.UMAMI_WEBSITE_ID} strategy="afterInteractive" id="umami-script" data-do-not-track="true" data-cache="false" onLoad={() => {
            // Test if Umami is working
            if (typeof window !== 'undefined' && window.umami) {
            }
        }} onError={(error) => {
            console.error("❌ Failed to load Umami analytics script:", error);
        }}/>) : null;
}
