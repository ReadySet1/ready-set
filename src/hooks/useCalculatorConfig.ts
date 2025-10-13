// useCalculatorConfig Hook - React hook for managing calculator configurations
// Provides state management and data fetching for calculator components

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  CalculatorConfig, 
  CalculatorTemplate, 
  ClientConfiguration,
  CalculationInput,
  CalculationResult,
  ConfigurationError
} from '@/types/calculator';

interface UseCalculatorConfigOptions {
  templateId?: string;
  clientConfigId?: string;
  autoLoad?: boolean;
}

interface UseCalculatorConfigReturn {
  // Configuration state
  config: CalculatorConfig | null;
  templates: CalculatorTemplate[];
  clientConfigs: ClientConfiguration[];
  
  // Loading states
  isLoading: boolean;
  isCalculating: boolean;
  isLoadingTemplates: boolean;
  
  // Error state
  error: string | null;
  
  // Actions
  loadConfig: (templateId: string, clientConfigId?: string) => Promise<void>;
  loadTemplates: () => Promise<void>;
  loadClientConfigs: (clientId?: string) => Promise<void>;
  calculate: (input: CalculationInput) => Promise<CalculationResult | null>;
  clearError: () => void;
  
  // Configuration management
  setActiveTemplate: (templateId: string) => void;
  setActiveClientConfig: (configId?: string) => void;
}

export function useCalculatorConfig(options: UseCalculatorConfigOptions = {}): UseCalculatorConfigReturn {
  const { templateId, clientConfigId, autoLoad = true } = options;

  // State
  const [config, setConfig] = useState<CalculatorConfig | null>(null);
  const [templates, setTemplates] = useState<CalculatorTemplate[]>([]);
  const [clientConfigs, setClientConfigs] = useState<ClientConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads calculator configuration
   */
  const loadConfig = useCallback(async (templateId: string, clientConfigId?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Get authentication session
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const url = new URL('/api/calculator/config', window.location.origin);
      url.searchParams.set('templateId', templateId);
      if (clientConfigId) {
        url.searchParams.set('clientConfigId', clientConfigId);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load calculator configuration');
      }

      const { data: calculatorConfig } = await response.json();
      setConfig(calculatorConfig);
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to load calculator configuration';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Loads all available templates
   */
  const loadTemplates = useCallback(async () => {
    try {
      setIsLoadingTemplates(true);
      setError(null);
      
      // Use session-based authentication (cookies will be included automatically)
      const response = await fetch('/api/calculator/templates', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load calculator templates');
      }
      
      const { data: templatesData } = await response.json();
      setTemplates(templatesData || []);
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to load calculator templates';
      setError(errorMessage);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  /**
   * Loads client configurations
   */
  const loadClientConfigs = useCallback(async (clientId?: string) => {
    try {
      setError(null);
      
      // Use session-based authentication (cookies will be included automatically)
      const url = new URL('/api/calculator/configurations', window.location.origin);
      if (clientId) {
        url.searchParams.set('clientId', clientId);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        setClientConfigs([]);
        return;
      }

      const { data: configs } = await response.json();
      setClientConfigs(configs || []);
    } catch (err) {
      // Don't set error, just use empty array as fallback
      setClientConfigs([]);
    }
  }, []);

  /**
   * Performs calculation using current configuration
   */
  const calculate = useCallback(async (input: CalculationInput): Promise<CalculationResult | null> => {
    if (!config?.template?.id) {
      setError('No calculator template selected');
      return null;
    }

    try {
      setIsCalculating(true);
      setError(null);
      
      // Get authentication session
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please sign in again.');
      }
      
      const response = await fetch('/api/calculator/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          templateId: config.template.id,
          clientConfigId: config.clientConfig?.id,
          saveHistory: true,
          ...input
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to perform calculation');
      }
      
      const { data: result } = await response.json();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to perform calculation';
      setError(errorMessage);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [config]);

  /**
   * Sets active template and reloads configuration
   */
  const setActiveTemplate = useCallback((templateId: string) => {
    loadConfig(templateId, config?.clientConfig?.id);
  }, [loadConfig, config?.clientConfig?.id]);

  /**
   * Sets active client configuration and reloads
   */
  const setActiveClientConfig = useCallback((configId?: string) => {
    if (config?.template?.id) {
      loadConfig(config.template.id, configId);
    }
  }, [loadConfig, config?.template?.id]);

  /**
   * Clears error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-load configuration on mount or when options change
  useEffect(() => {
    if (autoLoad && templateId) {
      loadConfig(templateId, clientConfigId);
    }
  }, [autoLoad, templateId, clientConfigId, loadConfig]);

  // Auto-load templates on mount
  useEffect(() => {
    if (autoLoad) {
      loadTemplates();
    }
  }, [autoLoad, loadTemplates]);

  return {
    // Configuration state
    config,
    templates,
    clientConfigs,
    
    // Loading states
    isLoading,
    isCalculating,
    isLoadingTemplates,
    
    // Error state
    error,
    
    // Actions
    loadConfig,
    loadTemplates,
    loadClientConfigs,
    calculate,
    clearError,
    
    // Configuration management
    setActiveTemplate,
    setActiveClientConfig
  };
}

/**
 * Hook for calculator history management
 */
interface UseCalculatorHistoryOptions {
  userId?: string;
  templateId?: string;
  limit?: number;
  autoLoad?: boolean;
}

interface UseCalculatorHistoryReturn {
  history: any[];
  isLoading: boolean;
  error: string | null;
  loadHistory: () => Promise<void>;
  clearError: () => void;
}

export function useCalculatorHistory(options: UseCalculatorHistoryOptions = {}): UseCalculatorHistoryReturn {
  const { userId, templateId, limit = 50, autoLoad = true } = options;

  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get authentication session
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please sign in again.');
      }
      
      const url = new URL('/api/calculator/history', window.location.origin);
      if (userId) {
        url.searchParams.set('userId', userId);
      }
      if (templateId) {
        url.searchParams.set('templateId', templateId);
      }
      url.searchParams.set('limit', limit.toString());
      
      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load calculation history');
      }
      
      const responseData = await response.json();
      const historyData = responseData.data;
      setHistory(historyData || []);
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to load calculation history';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [userId, templateId, limit]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadHistory();
    }
  }, [autoLoad, loadHistory]);

  return {
    history,
    isLoading,
    error,
    loadHistory,
    clearError
  };
}

/**
 * Hook for real-time calculation without persisting
 */
interface UseCalculatorReturn {
  result: CalculationResult | null;
  isCalculating: boolean;
  error: string | null;
  calculate: (input: CalculationInput) => Promise<void>;
  clearResult: () => void;
  clearError: () => void;
}

export function useCalculator(config: CalculatorConfig | null): UseCalculatorReturn {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(async (input: CalculationInput) => {
    if (!config?.template?.id) {
      setError('No calculator configuration available');
      return;
    }

    try {
      setIsCalculating(true);
      setError(null);

      // Get authentication session
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const requestBody = {
        templateId: config.template.id,
        clientConfigId: config.clientConfig?.id,
        saveHistory: false, // Don't save to history for real-time calculations
        ...input
      };

      const response = await fetch('/api/calculator/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to perform calculation');
      }

      const { data: calculationResult } = await response.json();
      setResult(calculationResult);
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to perform calculation';
      setError(errorMessage);
    } finally {
      setIsCalculating(false);
    }
  }, [config]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    result,
    isCalculating,
    error,
    calculate,
    clearResult,
    clearError
  };
}
