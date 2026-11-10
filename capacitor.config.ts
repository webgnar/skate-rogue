// The iOS app's Capacitor shell (npm run build:ios, docs/APP_STORE.md). The game is the same web build, loaded from
// the app bundle at capacitor://localhost; the Xcode project is ios/App.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.webgnar.skateescape',
  appName: 'Skate Escape',
  webDir: 'dist-ios',
  backgroundColor: '#120c1e',
  ios: {
    // the page lays itself out under the notch and home bar with env(safe-area-inset-*) (index.html viewport-fit=cover)
    contentInset: 'never',
    backgroundColor: '#120c1e',
    scrollEnabled: false,
    allowsLinkPreview: false,
    // the game is one page; nothing should rubber-band or zoom
    preferredContentMode: 'mobile',
  },
};

export default config;
