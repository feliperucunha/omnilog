# Publishing Geeklogs to Google Play Store

This app is configured to meet current Play Store technical requirements (target API 35, AAB, release signing). Follow these steps to build and publish.

## 1. Technical requirements (already done in this repo)

- **Target API level:** 35 (Android 15) — required for new apps and updates as of Aug 2025 ([Play requirements](https://developer.android.com/google/play/requirements/target-sdk)).
- **Android App Bundle (AAB):** Use the AAB for uploads; Play will generate optimized APKs. Bundle splits are enabled (ABI, density, language).
- **Release build:** `debuggable false`, `usesCleartextTraffic="false"`. Only `INTERNET` permission is declared.
- **Versioning:** Bump `versionCode` (integer) for each upload and set `versionName` (e.g. `"1.0"`) in `android/app/build.gradle` before releasing.
- **Launcher & splash icon:** Generated from `apps/web/public/logo-dark.png` (black background). After changing the web logo, run from repo root: `python3 apps/android/scripts/generate-launcher-icons.py` (requires Pillow).

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
pnpm run build --filter=@geeklogs/web
cd apps/android
pnpm run build
```

Or from `apps/android` after the web app is built:

```bash
cd apps/android/android
./gradlew bundleRelease
```

Output: `apps/android/android/app/build/outputs/bundle/release/app-release.aab`.

## Store listing copy (Play Console)

Paste **Short description** (max **80** characters per locale) and **Full description** (max **4000**) into Play Console → **Grow** → **Store presence** → **Main store listing**. Add the same texts under **Custom store listings** or **Translations** for **English (United States)**, **Portuguese (Brazil)**, and **Spanish** as needed.

Character counts below were checked for the short lines; trim if Google’s limit changes.

### English (en)

**Short description (73 characters)**

```
Track movies, TV, video games, board games, books, anime, manga & comics.
```

**Full description**

```
Geeklogs is one home for everything you watch, play, and read. Instead of juggling separate apps and spreadsheets, keep movies, TV shows, video games, board games, books, anime, manga, and comic books in a single list—with grades, short reviews, status, statistics, and optional social discovery.

WHAT YOU CAN DO

• Browse and add titles from popular catalogs (where you connect your own API keys for search, as documented in the app).
• Log custom entries when something is not in the database.
• Batch import many titles from a spreadsheet; export your logs to CSV from Settings or category views when your account supports it (check in-app help for API key and plan requirements).
• Track progress: seasons and episodes, chapters and volumes, started and completed dates, and time-based fields where they apply.
• Board games: catalog source preferences, collection flags (own, want, sold), optional purchase and sale amounts, mechanics, and play sessions with players, scores, and session notes—plus a running match count for your stats.
• Social: follow friends (and discover users from search) and see activity from people you follow.
• See summaries and charts for your activity over time.
• Use the app in light or dark theme and switch the interface among English, Portuguese (Brazil), and Spanish.
• Optional email recaps can highlight your monthly activity (if enabled in your account).

Geeklogs syncs with your account so your library stays available when you sign in on the web or other supported clients. Create a free account to get started.

Privacy and terms apply; see the links in the app or on the Geeklogs website for the current policies.
```

### Portuguese — Brazil (pt-BR)

**Short description (79 characters)**

```
Filmes, séries, jogos eletrônicos e de mesa, livros, anime, manga e quadrinhos.
```

**Full description**

```
O Geeklogs é um lugar só para tudo o que você assiste, joga e lê. Em vez de vários apps e planilhas, reúna filmes, séries, videogames, jogos de tabuleiro, livros, anime, manga e quadrinhos numa lista única—notas, resenhas curtas, status, estatísticas e descoberta social opcional.

O QUE DÁ PARA FAZER

• Pesquisar e adicionar títulos a partir de catálogos populares (quando você conecta suas próprias chaves de API para busca, conforme explicado no app).
• Registrar entradas manuais quando algo não está na base.
• Importação em lote por planilha e exportação dos registros em CSV nas Configurações ou nas listas por categoria quando sua conta permitir (veja a ajuda no app para requisitos de plano e chaves de API).
• Acompanhar progresso: temporadas e episódios, capítulos e volumes, datas de início e conclusão e campos de tempo quando fazem sentido.
• Jogos de tabuleiro: preferência de catálogo, campos de coleção (tenho, quero comprar, vendi), valores opcionais de compra e venda, mecânicas e partidas com jogadores, pontuações e notas da sessão—além da contagem de partidas nas estatísticas.
• Social: siga amigos (e descubra usuários na busca) e acompanhe a atividade de quem você segue.
• Ver resumos e gráficos da sua atividade ao longo do tempo.
• Tema claro ou escuro e interface em inglês, português (Brasil) ou espanhol.
• Resumos por e-mail opcionais do mês (se ativados na conta).

O Geeklogs sincroniza com a sua conta para manter a biblioteca ao entrar no site ou em outros clientes suportados. Crie uma conta gratuita para começar.

Privacidade e termos se aplicam; use os links no app ou no site do Geeklogs para as políticas atualizadas.
```

### Spanish (es)

**Short description (79 characters)**

```
Películas, series, videojuegos y juegos de mesa, libros, anime, manga y cómics.
```

**Full description**

```
Geeklogs es un solo hogar para todo lo que ves, juegas y lees. En lugar de repartir la información entre apps y hojas de cálculo, reúne películas, series, videojuegos, juegos de mesa, libros, anime, manga y cómics en una lista con notas, reseñas breves, estado, estadísticas y descubrimiento social opcional.

QUÉ PUEDES HACER

• Explorar y añadir títulos desde catálogos populares (cuando conectas tus propias claves de API para la búsqueda, según se indica en la app).
• Registrar entradas manuales si algo no está en la base de datos.
• Importación masiva desde hojas de cálculo y exportación de tus registros en CSV desde Ajustes o las listas por categoría cuando tu cuenta lo permita (consulta la ayuda en la app para requisitos de plan y claves API).
• Seguir el progreso: temporadas y episodios, capítulos y volúmenes, fechas de inicio y de finalización y campos de tiempo cuando correspondan.
• Juegos de mesa: preferencia de catálogo, datos de colección (tengo, quiero comprar, vendí), importes opcionales de compra y venta, mecánicas y partidas con jugadores, puntuaciones y notas de sesión—además del recuento de partidas en tus estadísticas.
• Social: sigue a amigos (y descubre usuarios desde la búsqueda) y consulta la actividad de quienes sigues.
• Ver resúmenes y gráficos de tu actividad a lo largo del tiempo.
• Tema claro u oscuro e interfaz en inglés, portugués (Brasil) o español.
• Resúmenes mensuales por correo opcionales (si los activas en la cuenta).

Geeklogs se sincroniza con tu cuenta para que tu biblioteca siga disponible al iniciar sesión en la web u otros clientes compatibles. Crea una cuenta gratuita para empezar.

Privacidad y términos aplican; consulta los enlaces en la app o en el sitio de Geeklogs para las políticas vigentes.
```

## 4. Play Console checklist (you do these in the browser)

- **Create the app** (if not already): Play Console → Create app → Fill in name, default language, type (e.g. App).
- **Store listing:** Short description, full description, screenshots (phone 16:9 or 9:16, 320–3840 px), feature graphic (1024×500), app icon (512×512). Optional: TV/banner graphics if you target TV. Draft copy for **English**, **Portuguese (Brazil)**, and **Spanish** is in [Store listing copy](#store-listing-copy-play-console) above.
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
