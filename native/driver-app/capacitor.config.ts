import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The shell loads the DEPLOYED driver web app (server.url) and reuses it as-is,
 * so the native app always runs the live UI with zero duplication. Override the
 * target per environment at sync time:
 *
 *   DRIVER_URL="https://www.readysetllc.com/native-launch" npx cap sync
 *
 * The entry point MUST be /native-launch and nothing else: it is the only
 * route guaranteed to answer 200 in every auth state. Any server-issued
 * redirect (307) on the entry navigation makes iOS WKWebView fail the
 * provisional load (blank page, then the OS bounces the user out to Safari) —
 * /driver redirects when signed out and /sign-in redirects when signed in.
 * /native-launch routes on the client instead.
 */
const driverUrl =
  process.env.DRIVER_URL ?? 'https://development.readysetllc.com/native-launch';

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
