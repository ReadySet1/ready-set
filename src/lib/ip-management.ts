// src/lib/ip-management.ts
import { NextRequest, NextResponse } from 'next/server';

// IP address validation and management
export class IPManager {
  private static instance: IPManager;
  private allowlist: Set<string> = new Set();
  private blocklist: Set<string> = new Set();
  private trustedProxies: Set<string> = new Set();

  private constructor() {
    this.initializeTrustedProxies();
  }

  static getInstance(): IPManager {
    if (!IPManager.instance) {
      IPManager.instance = new IPManager();
    }
    return IPManager.instance;
  }

  /**
   * Initialize trusted proxy list (commonly used proxy IPs)
   */
  private initializeTrustedProxies(): void {
    // Common proxy service IPs (add your actual proxy IPs here)
    const commonProxies = [
      '127.0.0.1', // localhost
      '::1', // localhost IPv6
      '10.0.0.0/8', // Private network
      '172.16.0.0/12', // Private network
      '192.168.0.0/16', // Private network
      // Add known proxy/CDN IPs
    ];

    commonProxies.forEach(proxy => this.trustedProxies.add(proxy));
  }

  /**
   * Add IP to allowlist
   */
  addToAllowlist(ip: string): void {
    this.allowlist.add(this.normalizeIP(ip));
    this.blocklist.delete(this.normalizeIP(ip)); // Remove from blocklist if present
  }

  /**
   * Remove IP from allowlist
   */
  removeFromAllowlist(ip: string): void {
    this.allowlist.delete(this.normalizeIP(ip));
  }

  /**
   * Add IP to blocklist
   */
  addToBlocklist(ip: string): void {
    this.blocklist.add(this.normalizeIP(ip));
    this.allowlist.delete(this.normalizeIP(ip)); // Remove from allowlist if present
  }

  /**
   * Remove IP from blocklist
   */
  removeFromBlocklist(ip: string): void {
    this.blocklist.delete(this.normalizeIP(ip));
  }

  /**
   * Check if IP is in allowlist
   */
  isAllowed(ip: string): boolean {
    const normalizedIP = this.normalizeIP(ip);

    // If allowlist is not empty, only allowlisted IPs are permitted
    if (this.allowlist.size > 0) {
      return this.allowlist.has(normalizedIP);
    }

    // If allowlist is empty, check blocklist
    return !this.blocklist.has(normalizedIP);
  }

  /**
   * Check if IP is in blocklist
   */
  isBlocked(ip: string): boolean {
    return this.blocklist.has(this.normalizeIP(ip));
  }

  /**
   * Check if IP is from a trusted proxy
   */
  isTrustedProxy(ip: string): boolean {
    return this.trustedProxies.has(ip) || this.isPrivateIP(ip);
  }

  /**
   * Get the real client IP from request headers
   */
  getClientIP(request: NextRequest): string {
    // Try various headers in order of preference
    const headers = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'cf-connecting-ip', // Cloudflare
      'x-cluster-client-ip', // AWS
      'x-forwarded',
      'forwarded-for',
      'forwarded'
    ];

    for (const header of headers) {
      const value = request.headers.get(header);
      if (value) {
        // Handle comma-separated values (take first non-proxy IP)
        const ips = value.split(',').map(ip => ip.trim());
        for (const ip of ips) {
          if (ip && !this.isTrustedProxy(ip)) {
            return this.normalizeIP(ip);
          }
        }
      }
    }

    // Fallback to direct connection IP
    return this.normalizeIP('unknown');
  }

  /**
   * Validate IP address format
   */
  isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if IP is private/internal
   */
  isPrivateIP(ip: string): boolean {
    if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') {
      return true;
    }

    // Check for private IPv4 ranges
    const parts = ip.split('.').map(Number);
    if (parts.length >= 4 && parts.every(part => !isNaN(part)) && parts[1] !== undefined) {
      // 10.0.0.0/8
      if (parts[0] === 10) return true;
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true;
    }

    // Check for private IPv6 ranges
    if (ip.startsWith('fc00:') || ip.startsWith('fd00:') || ip.startsWith('::1')) {
      return true;
    }

    return false;
  }

  /**
   * Normalize IP address (remove port, normalize format)
   */
  private normalizeIP(ip: string): string {
    if (!ip || ip === 'unknown') return ip;

    // Remove port if present
    const cleanIP = ip.split(':')[0];

    // Validate and return clean IP
    return cleanIP && this.isValidIP(cleanIP) ? cleanIP : 'invalid';
  }

  /**
   * Get allowlist as array
   */
  getAllowlist(): string[] {
    return Array.from(this.allowlist);
  }

  /**
   * Get blocklist as array
   */
  getBlocklist(): string[] {
    return Array.from(this.blocklist);
  }

  /**
   * Clear all lists
   */
  clearLists(): void {
    this.allowlist.clear();
    this.blocklist.clear();
  }

  /**
   * Load IP lists from configuration
   */
  loadFromConfig(config: {
    allowlist?: string[];
    blocklist?: string[];
    trustedProxies?: string[];
  }): void {
    if (config.allowlist) {
      config.allowlist.forEach(ip => this.addToAllowlist(ip));
    }

    if (config.blocklist) {
      config.blocklist.forEach(ip => this.addToBlocklist(ip));
    }

    if (config.trustedProxies) {
      config.trustedProxies.forEach(proxy => this.trustedProxies.add(proxy));
    }
  }

  /**
   * Export current configuration
   */
  exportConfig(): {
    allowlist: string[];
    blocklist: string[];
    trustedProxies: string[];
  } {
    return {
      allowlist: this.getAllowlist(),
      blocklist: this.getBlocklist(),
      trustedProxies: Array.from(this.trustedProxies)
    };
  }
}

// Export singleton instance
export const ipManager = IPManager.getInstance();

// IP-based access control middleware
export interface IPAccessControlConfig {
  allowlist?: string[];
  blocklist?: string[];
  requireAuthentication?: boolean;
  allowPrivateIPs?: boolean;
  allowTrustedProxies?: boolean;
  enableThreatIntelligence?: boolean;
  geolocationRules?: GeolocationRule[];
  blockTorExitNodes?: boolean;
  blockVPNs?: boolean;
  logBlockedRequests?: boolean;
  customBlockHandler?: (ip: string, reason: string) => NextResponse;
}

export function withIPAccessControl(config: IPAccessControlConfig = {}) {
  const {
    allowlist = [],
    blocklist = [],
    requireAuthentication = false,
    allowPrivateIPs = true,
    allowTrustedProxies = true,
    blockTorExitNodes = false,
    blockVPNs = false,
    logBlockedRequests = true,
    customBlockHandler
  } = config;

  return async function ipAccessControlMiddleware(request: NextRequest): Promise<NextResponse | null> {
    const clientIP = ipManager.getClientIP(request);

    // Load IP lists if provided
    if (allowlist.length > 0 || blocklist.length > 0) {
      ipManager.loadFromConfig({ allowlist, blocklist });
    }

    // Check if IP is blocked
    if (ipManager.isBlocked(clientIP)) {
      if (logBlockedRequests) {
        console.warn(`🚫 [IP BLOCKED] Access denied for IP: ${clientIP} on ${request.nextUrl.pathname}`);
      }

      if (customBlockHandler) {
        return customBlockHandler(clientIP, 'blocked');
      }

      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'Your IP address has been blocked',
          code: 'IP_BLOCKED'
        },
        { status: 403 }
      );
    }

    // Check if IP is allowed
    if (!ipManager.isAllowed(clientIP)) {
      if (logBlockedRequests) {
        console.warn(`🚫 [IP NOT ALLOWED] Access denied for IP: ${clientIP} on ${request.nextUrl.pathname}`);
      }

      if (customBlockHandler) {
        return customBlockHandler(clientIP, 'not_allowed');
      }

      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'Your IP address is not allowed to access this resource',
          code: 'IP_NOT_ALLOWED'
        },
        { status: 403 }
      );
    }

    // Additional checks for private IPs
    if (!allowPrivateIPs && ipManager.isPrivateIP(clientIP)) {
      if (logBlockedRequests) {
        console.warn(`🚫 [PRIVATE IP BLOCKED] Access denied for private IP: ${clientIP}`);
      }

      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'Private IP addresses are not allowed',
          code: 'PRIVATE_IP_BLOCKED'
        },
        { status: 403 }
      );
    }

    // Additional checks for trusted proxies
    if (!allowTrustedProxies && ipManager.isTrustedProxy(clientIP)) {
      if (logBlockedRequests) {
        console.warn(`🚫 [TRUSTED PROXY BLOCKED] Access denied for proxy IP: ${clientIP}`);
      }

      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'Proxy access is not allowed',
          code: 'PROXY_BLOCKED'
        },
        { status: 403 }
      );
    }

    return null; // Access allowed
  };
}

// Geolocation-based IP filtering (basic implementation)
export interface GeolocationRule {
  country: string;
  action: 'allow' | 'block';
  reason?: string;
}

// Geolocation-based access control
export class GeolocationManager {
  private rules: GeolocationRule[] = [];

  /**
   * Add geolocation rule
   */
  addRule(country: string, action: 'allow' | 'block', reason?: string): void {
    this.rules.push({ country: country.toUpperCase(), action, reason });
  }

  /**
   * Check if country is allowed/blocked
   */
  checkCountry(country: string): { allowed: boolean; rule?: GeolocationRule } {
    const normalizedCountry = country.toUpperCase();
    const rule = this.rules.find(r => r.country === normalizedCountry);

    if (rule) {
      return { allowed: rule.action === 'allow', rule };
    }

    // Default: allow if no rule exists
    return { allowed: true };
  }

  /**
   * Get all rules
   */
  getRules(): GeolocationRule[] {
    return [...this.rules];
  }

  /**
   * Clear all rules
   */
  clearRules(): void {
    this.rules = [];
  }
}

// Export geolocation manager instance
export const geolocationManager = new GeolocationManager();

// IP range utilities
export class IPRangeManager {
  /**
   * Check if IP is in CIDR range
   */
  static isIPInRange(ip: string, cidr: string): boolean {
    try {
      const [range, bits] = cidr.split('/');
      const mask = bits ? parseInt(bits) : NaN;

      if (!range || !bits || isNaN(mask) || mask < 0 || mask > 32) {
        return false;
      }

      // Convert IPs to numbers
      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(range);
      const maskNum = ~((1 << (32 - mask)) - 1);

      return (ipNum & maskNum) === (rangeNum & maskNum);
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert IP address to number
   */
  private static ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  /**
   * Get IP range information
   */
  static getIPInfo(ip: string): {
    isValid: boolean;
    version: 'IPv4' | 'IPv6' | 'invalid';
    isPrivate: boolean;
    range?: string;
  } {
    if (!ipManager.isValidIP(ip)) {
      return { isValid: false, version: 'invalid', isPrivate: false };
    }

    const isPrivate = ipManager.isPrivateIP(ip);

    // Determine IP version
    const version = ip.includes(':') ? 'IPv6' : 'IPv4';

    // Get common range information
    let range: string | undefined;
    if (ip.startsWith('10.')) range = '10.0.0.0/8';
    else if (ip.startsWith('172.')) {
      const parts = ip.split('.');
      if (parts.length >= 2 && parts[1] !== undefined) {
        const secondOctet = parseInt(parts[1]);
        if (!isNaN(secondOctet) && secondOctet >= 16 && secondOctet <= 31) range = '172.16.0.0/12';
      }
    }
    else if (ip.startsWith('192.168.')) range = '192.168.0.0/16';
    else if (ip.startsWith('127.')) range = '127.0.0.0/8';
    else if (ip === '::1' || ip.startsWith('::')) range = '::1/128';

    return { isValid: true, version, isPrivate, range };
  }

  /**
   * Validate CIDR notation
   */
  static isValidCIDR(cidr: string): boolean {
    const parts = cidr.split('/');
    if (parts.length !== 2) return false;

    const [ip, bits] = parts;
    if (!ip || !bits) return false;

    const mask = parseInt(bits);

    if (isNaN(mask) || mask < 0 || mask > 32) return false;

    return ipManager.isValidIP(ip);
  }
}

// IP threat intelligence (basic implementation)
export interface IPThreatInfo {
  ip: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  categories: string[];
  lastSeen: Date;
  confidence: number; // 0-100
}

// Basic threat intelligence database (in production, use a real threat feed)
const threatDatabase = new Map<string, IPThreatInfo>();

export class ThreatIntelligence {
  /**
   * Check if IP has known threats
   */
  static checkIP(ip: string): IPThreatInfo | null {
    return threatDatabase.get(ip) || null;
  }

  /**
   * Report suspicious IP
   */
  static reportIP(ip: string, threatLevel: IPThreatInfo['threatLevel'], categories: string[]): void {
    threatDatabase.set(ip, {
      ip,
      threatLevel,
      categories,
      lastSeen: new Date(),
      confidence: 80 // Default confidence
    });
  }

  /**
   * Get threat statistics
   */
  static getStats(): {
    totalThreats: number;
    byLevel: Record<IPThreatInfo['threatLevel'], number>;
    byCategory: Record<string, number>;
  } {
    const stats = {
      totalThreats: threatDatabase.size,
      byLevel: { low: 0, medium: 0, high: 0, critical: 0 } as Record<IPThreatInfo['threatLevel'], number>,
      byCategory: {} as Record<string, number>
    };

    threatDatabase.forEach(info => {
      stats.byLevel[info.threatLevel]++;
      info.categories.forEach(category => {
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * Cleanup old threat data
   */
  static cleanup(maxAgeDays: number = 30): number {
    const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    let removed = 0;

    for (const [ip, info] of threatDatabase.entries()) {
      if (info.lastSeen < cutoffDate) {
        threatDatabase.delete(ip);
        removed++;
      }
    }

    return removed;
  }
}

// IP access control with threat intelligence
export function withAdvancedIPAccessControl(config: IPAccessControlConfig & {
  enableThreatIntelligence?: boolean;
  geolocationRules?: GeolocationRule[];
} = {}) {
  const {
    enableThreatIntelligence = true,
    geolocationRules = [],
    ...baseConfig
  } = config;

  return async function advancedIPAccessControlMiddleware(request: NextRequest): Promise<NextResponse | null> {
    const clientIP = ipManager.getClientIP(request);

    // Apply basic IP access control
    const basicCheck = await withIPAccessControl(baseConfig)(request);
    if (basicCheck) {
      return basicCheck;
    }

    // Check threat intelligence
    if (enableThreatIntelligence) {
      const threatInfo = ThreatIntelligence.checkIP(clientIP);
      if (threatInfo) {
        console.warn(`🚨 [THREAT DETECTED] IP ${clientIP} has threat level: ${threatInfo.threatLevel}`);

        return NextResponse.json(
          {
            error: 'Access denied',
            message: 'Your IP address has been flagged for suspicious activity',
            threatLevel: threatInfo.threatLevel,
            categories: threatInfo.categories,
            code: 'THREAT_DETECTED'
          },
          { status: 403 }
        );
      }
    }

    // Apply geolocation rules
    if (geolocationRules.length > 0) {
      geolocationManager.clearRules();
      geolocationRules.forEach(rule => geolocationManager.addRule(rule.country, rule.action, rule.reason));

      // Note: In a real implementation, you'd get the actual country from the IP
      // For now, this is a placeholder for geolocation-based filtering
      const countryCheck = geolocationManager.checkCountry('US'); // Placeholder
      if (!countryCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Access denied',
            message: countryCheck.rule?.reason || 'Geographic access restriction',
            code: 'GEOLOCATION_BLOCKED'
          },
          { status: 403 }
        );
      }
    }

    return null; // Access allowed
  };
}
