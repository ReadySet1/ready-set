// src/lib/recaptcha.ts

/**
 * Google reCAPTCHA v3 Integration
 *
 * Provides invisible bot protection for forms without user interaction.
 * reCAPTCHA v3 returns a score (0.0 - 1.0) indicating the likelihood that the user is human.
 *
 * Configuration:
 * - Client-side: NEXT_PUBLIC_RECAPTCHA_SITE_KEY
 * - Server-side: RECAPTCHA_SECRET_KEY
 *
 * If keys are not configured, the system degrades gracefully.
 */

import { authLogger } from '@/utils/logger';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export interface RecaptchaVerificationResult {
  success: boolean;
  score?: number; // 0.0 - 1.0, higher is more likely human
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Client-side: Load the reCAPTCHA script
 * Call this once when the app initializes or when the contact form mounts
 */
export function loadRecaptchaScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    // If no site key, skip reCAPTCHA (graceful degradation)
    if (!siteKey) {
      authLogger.warn('[reCAPTCHA] Site key not configured, skipping reCAPTCHA');
      resolve();
      return;
    }

    // Check if already loaded
    if (typeof window.grecaptcha !== 'undefined') {
      resolve();
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      authLogger.info('[reCAPTCHA] Script loaded successfully');
      resolve();
    };

    script.onerror = () => {
      authLogger.error('[reCAPTCHA] Failed to load script');
      reject(new Error('Failed to load reCAPTCHA script'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Client-side: Execute reCAPTCHA and get a token
 * Call this when the user submits the form
 *
 * @param action - The action name (e.g., 'contact_form_submit')
 * @returns reCAPTCHA token or null if not configured
 */
export async function executeRecaptcha(action: string): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  // If no site key, return null (graceful degradation)
  if (!siteKey) {
    authLogger.warn('[reCAPTCHA] Site key not configured, skipping verification');
    return null;
  }

  // Check if grecaptcha is loaded
  if (typeof window.grecaptcha === 'undefined') {
    authLogger.error('[reCAPTCHA] grecaptcha not loaded');
    return null;
  }

  try {
    // Wait for reCAPTCHA to be ready and execute
    const token = await new Promise<string>((resolve, reject) => {
      window.grecaptcha.ready(async () => {
        try {
          const result = await window.grecaptcha.execute(siteKey, { action });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    authLogger.info('[reCAPTCHA] Token generated successfully');
    return token;
  } catch (error) {
    authLogger.error('[reCAPTCHA] Failed to execute:', { error });
    return null;
  }
}

/**
 * Server-side: Verify reCAPTCHA token
 * Call this in your server action/API route
 *
 * @param token - The reCAPTCHA token from the client
 * @param minScore - Minimum acceptable score (default: 0.5)
 * @returns Verification result
 */
export async function verifyRecaptchaToken(
  token: string,
  minScore: number = 0.5
): Promise<{
  success: boolean;
  score: number;
  message?: string;
}> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  // If no secret key, skip verification (graceful degradation)
  if (!secretKey) {
    authLogger.warn('[reCAPTCHA] Secret key not configured, skipping verification');
    return {
      success: true,
      score: 1.0,
      message: 'reCAPTCHA not configured',
    };
  }

  // If no token provided, fail verification
  if (!token) {
    return {
      success: false,
      score: 0,
      message: 'No reCAPTCHA token provided',
    };
  }

  try {
    // Verify token with Google
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const result: RecaptchaVerificationResult = await response.json();

    if (!result.success) {
      authLogger.warn('[reCAPTCHA] Verification failed', { errorCodes: result['error-codes'] });
      return {
        success: false,
        score: 0,
        message: `reCAPTCHA verification failed: ${result['error-codes']?.join(', ')}`,
      };
    }

    const score = result.score || 0;

    // Check if score meets minimum threshold
    if (score < minScore) {
      authLogger.warn('[reCAPTCHA] Score too low', { score, minScore });
      return {
        success: false,
        score,
        message: `reCAPTCHA score too low (${score.toFixed(2)})`,
      };
    }

    authLogger.info('[reCAPTCHA] Verification successful', { score: score.toFixed(2) });
    return {
      success: true,
      score,
    };
  } catch (error) {
    authLogger.error('[reCAPTCHA] Verification error', { error });
    return {
      success: false,
      score: 0,
      message: 'reCAPTCHA verification failed due to network error',
    };
  }
}

/**
 * Get recommended action based on reCAPTCHA score
 *
 * Score interpretation (Google's recommendations):
 * - 0.9 - 1.0: Very likely a human, safe to proceed
 * - 0.7 - 0.9: Likely a human, safe to proceed
 * - 0.5 - 0.7: Unclear, consider secondary verification
 * - 0.3 - 0.5: Likely a bot, add friction (e.g., additional verification)
 * - 0.0 - 0.3: Very likely a bot, block or challenge
 *
 * @param score - reCAPTCHA score (0.0 - 1.0)
 * @returns Recommended action
 */
export function getRecaptchaActionRecommendation(score: number): {
  action: 'allow' | 'challenge' | 'block';
  reason: string;
} {
  if (score >= 0.7) {
    return {
      action: 'allow',
      reason: 'High confidence human user',
    };
  } else if (score >= 0.5) {
    return {
      action: 'allow',
      reason: 'Moderate confidence human user',
    };
  } else if (score >= 0.3) {
    return {
      action: 'challenge',
      reason: 'Low confidence, recommend additional verification',
    };
  } else {
    return {
      action: 'block',
      reason: 'Very likely bot',
    };
  }
}
