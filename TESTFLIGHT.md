# TestFlight Readiness

This project is configured for an Expo EAS iOS production build.

## Local checks

Run:

```bash
npm run typecheck
npx expo-doctor
npx expo export --platform ios --output-dir /tmp/leanbulk-testflight-check
```

## First-time setup

Run:

```bash
npm install -g eas-cli
eas login
eas build:configure
```

If Expo asks to link or create an EAS project, accept it.

## Build for TestFlight

Run:

```bash
npm run eas:build:ios
```

That creates a store-signed iOS build using the `production` EAS profile.

## Submit to App Store Connect / TestFlight

Run:

```bash
npm run eas:submit:ios
```

You will still need:

- an Apple Developer account
- an App Store Connect app record for `com.mubaris.leanbulktracker`
- App Store Connect API key or interactive Apple auth
- store metadata, screenshots, privacy policy URL, and review notes

## Important production note

Dev auto-signin is now gated behind `EXPO_PUBLIC_ENABLE_AUTO_SIGNIN=1` and only works in development builds. Production/TestFlight builds disable it by default through `eas.json`.
