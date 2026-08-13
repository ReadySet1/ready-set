import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The shell loads the DEPLOYED driver web app (server.url) and reuses it as-is,
 * so the native app always runs the live UI with zero duplication. Override the
 * target per environment at sync time:
 *
 *   DRIVER_URL="https://www.readysetllc.com/sign-in?returnTo=%2Fdriver" npx cap sync
 *
 * The entry point MUST be /sign-in, never /driver: an unauthenticated /driver
 * load answers with a 307 to /sign-in, and iOS WKWebView fails that provisional
 * navigation (blank page, then the OS bounces the user out to Safari). /sign-in
 * never redirects for signed-out users, and authenticated users are self-healed
 * off /sign-in back to /driver by the web app itself.
 */
const driverUrl =
  process.env.DRIVER_URL ??
  'https://development.readysetllc.com/sign-in?returnTo=%2Fdriver';

const config: CapacitorConfig = {
  appId: 'co.readyset.driver',
  appName: 'Ready Set Driver',
  // Required by Capacitor even when loading a remote URL; www/index.html is the
  // offline fallback shown only if server.url is unreachable.
  webDir: 'www',
  server: {
    url: driverUrl,
    cleartext: false,
  },
  // The @capacitor-community/background-geolocation plugin has no JS-side config
  // block — its permissions live in the native projects (Info.plist / Manifest).
  // See README → Permissions.
};

export default config;
