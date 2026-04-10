# Android App Links

The app registers:

1. **HTTPS** — `https://<app_link_host>/…` (see `app_link_host` in `apps/android/android/app/src/main/res/values/strings.xml`; default `geeklogs.com.br`).
2. **Custom scheme** — `geeklogs://app/…` (no server file required).

## Web build

Set `VITE_APP_WEB_ORIGIN` to your public site origin (same host as `app_link_host`), e.g.:

`https://geeklogs.com.br`

This is used at runtime to match opened HTTPS URLs and for in-app navigation from external links.

## Verified App Links (`assetlinks.json`)

Host this file at:

`https://<your-domain>/.well-known/assetlinks.json`

Replace `YOUR_SHA256_HEX` with your **release** keystore certificate fingerprint (Google Play App Signing or your upload key):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.geeklogs.app",
      "sha256_cert_fingerprints": ["YOUR_SHA256_HEX"]
    }
  }
]
```

Get the fingerprint:

```bash
keytool -list -v -keystore your-release.keystore -alias your-alias
```

After deploying `assetlinks.json`, reinstall the app on a device; Android verifies links asynchronously.

## iOS

Add **Associated Domains** in Xcode for the same host if you want universal links on iOS (separate from Android manifest).
