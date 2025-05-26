"use client";

import { useEffect, useState } from 'react';
import { useUmami } from '@/hooks/useUmami';
import { Button } from '@/components/ui/button';
import { CONSTANTS } from '@/constants';

interface UmamiStatus {
  scriptLoaded: boolean;
  umamiAvailable: boolean;
  lastEvent: string | null;
  errorMessage: string | null;
}

export default function UmamiTestComponent() {
  const [status, setStatus] = useState<UmamiStatus>({
    scriptLoaded: false,
    umamiAvailable: false,
    lastEvent: null,
    errorMessage: null
  });
  const [logs, setLogs] = useState<string[]>([]);
  const { trackEvent, trackPageView } = useUmami();
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp} - ${message}`]);
  };

  const checkUmamiStatus = () => {
    try {
      const scriptElement = document.getElementById('umami-script');
      const scriptLoaded = !!scriptElement;
      const umamiAvailable = typeof window !== 'undefined' && !!window.umami;
      
      setStatus(prev => ({
        ...prev,
        scriptLoaded,
        umamiAvailable,
        errorMessage: null
      }));
      
      addLog(`Script loaded: ${scriptLoaded}, Umami available: ${umamiAvailable}`);
      
      if (scriptLoaded && !umamiAvailable) {
        addLog('⚠️ Script loaded but window.umami not available - check console for errors');
      }
      
      return { scriptLoaded, umamiAvailable };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(prev => ({ ...prev, errorMessage }));
      addLog(`❌ Error checking status: ${errorMessage}`);
      return { scriptLoaded: false, umamiAvailable: false };
    }
  };

  useEffect(() => {
    addLog('🔍 UmamiTestComponent mounted');
    
    // Initial check
    checkUmamiStatus();
    
    // Check periodically in case the script loads after component mount
    const interval = setInterval(() => {
      const { umamiAvailable } = checkUmamiStatus();
      if (umamiAvailable) {
        clearInterval(interval);
        addLog('✅ Umami is now available!');
      }
    }, 1000);
    
         // Check cookie preferences and configuration
     try {
       const consentStatus = localStorage.getItem('cookieConsentStatus');
       const preferences = JSON.parse(localStorage.getItem('cookiePreferences') || '{}');
       addLog(`Cookie consent: ${consentStatus}, Analytics: ${preferences.analytics}`);
       addLog(`Umami Host: ${CONSTANTS.UMAMI_HOST_URL}`);
       addLog(`Website ID: ${CONSTANTS.UMAMI_WEBSITE_ID}`);
     } catch (error) {
       addLog('Could not read cookie preferences');
     }
    
    return () => clearInterval(interval);
  }, []);

  const testPageView = () => {
    addLog('🔄 Testing page view tracking...');
    trackPageView('/test-page-view');
    setStatus(prev => ({ ...prev, lastEvent: 'pageview' }));
  };

  const testCustomEvent = () => {
    addLog('🎯 Testing custom event tracking...');
    trackEvent('test_button_click', {
      component: 'UmamiTestComponent',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.substring(0, 50)
    });
    setStatus(prev => ({ ...prev, lastEvent: 'test_button_click' }));
  };

  const testConversionEvent = () => {
    addLog('💰 Testing conversion event...');
    trackEvent('test_conversion', {
      value: 99.99,
      currency: 'USD',
      category: 'test'
    });
    setStatus(prev => ({ ...prev, lastEvent: 'test_conversion' }));
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('📝 Logs cleared');
  };

     const refreshStatus = () => {
     addLog('🔄 Refreshing status...');
     checkUmamiStatus();
   };

   const verifyConfiguration = () => {
     addLog('🔍 Verifying Umami configuration...');
     addLog(`Current domain: ${window.location.hostname}`);
     addLog(`Current URL: ${window.location.href}`);
     addLog(`Script URL: ${CONSTANTS.UMAMI_HOST_URL}/script.js`);
     
     // Check if script element exists and has correct attributes
     const scriptEl = document.getElementById('umami-script') as HTMLScriptElement;
     if (scriptEl) {
       addLog(`Script src: ${scriptEl.src}`);
       addLog(`Website ID: ${scriptEl.getAttribute('data-website-id')}`);
     } else {
       addLog('❌ Umami script element not found');
     }
   };

   const testConnectivity = async () => {
     addLog('🌐 Testing connectivity to self-hosted Umami...');
     try {
       const response = await fetch('/api/test-umami');
       const data = await response.json();
       
       addLog(`Test completed at ${data.timestamp}`);
       data.tests.forEach((test: any) => {
         const emoji = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : 'ℹ️';
         addLog(`${emoji} ${test.name}: ${test.status} - ${test.details}`);
       });
     } catch (error) {
       addLog(`❌ Connectivity test failed: ${error instanceof Error ? error.message : String(error)}`);
     }
   };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Umami Analytics Test Dashboard</h2>
        
        {/* Status Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">Script Status</h3>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${status.scriptLoaded ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-sm">Script Loaded: {status.scriptLoaded ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${status.umamiAvailable ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-sm">Umami Available: {status.umamiAvailable ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">Tracking Status</h3>
            <div className="space-y-1">
              <div className="text-sm">Last Event: {status.lastEvent || 'None'}</div>
              {status.errorMessage && (
                <div className="text-sm text-red-600">Error: {status.errorMessage}</div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button onClick={testPageView} variant="outline" size="sm">
            📊 Test Page View
          </Button>
          <Button onClick={testCustomEvent} variant="outline" size="sm">
            🎯 Test Custom Event
          </Button>
          <Button onClick={testConversionEvent} variant="outline" size="sm">
            💰 Test Conversion
          </Button>
          <Button onClick={refreshStatus} variant="outline" size="sm">
            🔄 Refresh Status
          </Button>
          <Button onClick={verifyConfiguration} variant="outline" size="sm">
            🔍 Verify Config
          </Button>
          <Button onClick={testConnectivity} variant="outline" size="sm">
            🌐 Test Connectivity
          </Button>
          <Button onClick={clearLogs} variant="outline" size="sm">
            🗑️ Clear Logs
          </Button>
        </div>

        {/* Logs Section */}
        <div className="bg-black text-white rounded-lg p-4">
          <h3 className="font-semibold mb-2">Test Logs</h3>
          <div className="max-h-60 overflow-y-auto space-y-1 font-mono text-sm">
            {logs.map((log, i) => (
              <div key={i} className="border-b border-gray-800 pb-1">{log}</div>
            ))}
            {logs.length === 0 && (
              <div className="text-gray-500">No logs yet... Click the buttons above to test!</div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">How to verify your self-hosted Umami is working:</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Click "Test Connectivity" to verify your self-hosted instance is accessible</li>
            <li>Both status indicators above should be green</li>
            <li>Click the test buttons and watch the logs</li>
            <li>Check your browser's Network tab for requests to <code className="bg-blue-100 px-1 rounded">analytics.readysetllc.com</code></li>
            <li>Check your Umami dashboard at <a href="https://analytics.readysetllc.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">analytics.readysetllc.com</a> for the test events appearing</li>
            <li>Look for console logs starting with "✅ Umami" or "🎯 Umami"</li>
            <li>Verify your website domain is properly configured in your Umami site settings</li>
          </ol>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <h4 className="font-medium text-yellow-800 mb-1">⚠️ Common Issues:</h4>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>• Make sure your domain is added to the Umami website settings</li>
              <li>• Check that the Website ID matches your Umami dashboard</li>
              <li>• Verify CORS is properly configured on your Umami server</li>
              <li>• Ensure SSL certificates are valid for analytics.readysetllc.com</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 