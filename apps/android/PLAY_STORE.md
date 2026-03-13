# Publishing Dogument to Google Play Store

This app is configured to meet current Play Store technical requirements (target API 35, AAB, release signing). Follow these steps to build and publish.

## 1. Technical requirements (already done in this repo)

- **Target API level:** 35 (Android 15) — required for new apps and updates as of Aug 2025 ([Play requirements](https://developer.android.com/google/play/requirements/target-sdk)).
- **Android App Bundle (AAB):** Use the AAB for uploads; Play will generate optimized APKs. Bundle splits are enabled (ABI, density, language).
- **Release build:** `debuggable false`, `usesCleartextTraffic="false"`. Only `INTERNET` permission is declared.
- **Versioning:** Bump `versionCode` (integer) for each upload and set `versionName` (e.g. `"1.0"`) in `android/app/build.gradle` before releasing.

## 2. App signing

You can use **Play App Signing** (recommended) or sign the AAB yourself.

### Option A: Play App Signing (recommended)

1. In [Play Console](https://play.google.com/console) → Your app → **Setup** → **App signing**, enroll in Play App Signing.
2. For the first upload you can use an **upload key** (you create and keep the keystore). Play will use it to sign the app for distribution.
3. Create an upload keystore (once):

   ```bash
   keytool -genkey -v -keystore android/app/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

   Do **not** commit `upload-keystore.jks` or passwords. Add `android/app/*.jks` to `.gitignore` if needed.

4. Build the AAB signed with the upload key (see section 3), then upload the AAB to Play Console. Play will prompt you to register the upload key if it’s the first time.

### Option B: Sign the AAB with environment variables

The project is set up to use release signing when these env vars are set:

- `RELEASE_STORE_FILE` — path to the keystore file (e.g. `android/app/upload-keystore.jks`)
- `RELEASE_STORE_PASSWORD`
- `RELEASE_KEY_ALIAS`
- `RELEASE_KEY_PASSWORD`

Example (from repo root, with keystore in `apps/android/android/app/`):

```bash
cd apps/android/android
export RELEASE_STORE_FILE=app/upload-keystore.jks
export RELEASE_STORE_PASSWORD=your_store_password
export RELEASE_KEY_ALIAS=upload
export RELEASE_KEY_PASSWORD=your_key_password
./gradlew bundleRelease
```

The AAB will be at `app/build/outputs/bundle/release/app-release.aab`. Upload this file in Play Console.

If these env vars are **not** set, `bundleRelease` still runs but the bundle is signed with the debug key (only for local/testing; do not use for production).

## 3. Build the AAB

From the **monorepo root** (so the web app is built first):

```bash
pnpm install
pnpm run build --filter=@dogument/web
cd apps/android
pnpm run build
```

Or from `apps/android` after the web app is built:

```bash
cd apps/android/android
./gradlew bundleRelease
```

Output: `apps/android/android/app/build/outputs/bundle/release/app-release.aab`.

## 4. Play Console checklist (you do these in the browser)

- **Create the app** (if not already): Play Console → Create app → Fill in name, default language, type (e.g. App).
- **Store listing:** Short description, full description, screenshots (phone 16:9 or 9:16, 320–3840 px), feature graphic (1024×500), app icon (512×512). Optional: TV/banner graphics if you target TV.
- **Content rating:** Complete the questionnaire (e.g. IARC). Submit and attach the rating to the release.
- **Privacy policy:** If the app collects any user data (e.g. account, usage), add a privacy policy URL in Store listing and in the **App content** section.
- **Data safety:** In **App content** → **Data safety**, declare what data is collected (e.g. account info, app interactions) and how it’s used (e.g. app functionality). Be accurate; the app uses credentials and likely API usage.
- **Target audience:** Set age groups if required by your content rating.
- **Release:** Create a release (e.g. Production), upload the AAB, add release name (e.g. “1.0 (1)”), save, then submit for review.

## 5. Updating the app

1. In `apps/android/android/app/build.gradle`, increase `versionCode` (e.g. to `2`) and set `versionName` (e.g. `"1.1"`).
2. Build a new AAB (section 3) with the same signing key (or upload key if using Play App Signing).
3. In Play Console, create a new release, upload the new AAB, and submit.

## References

- [Target API level requirement](https://developer.android.com/google/play/requirements/target-sdk)
- [Play Console Help – Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152)
- [App signing (Play App Signing)](https://support.google.com/googleplay/android-developer/answer/9842756)
