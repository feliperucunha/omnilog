/** Link and tutorial for each API key (used on Settings page and search prompt). */
export const API_KEY_META = {
  tmdb: {
    name: "TMDB (Movies & TV)",
    link: "https://www.themoviedb.org/settings/api",
    tutorial: `1. Go to themoviedb.org and create a free account or log in.
2. Open Settings → API from the left menu (or go to the link below).
3. Click "Request an API Key" and choose "Developer".
4. Accept the terms and fill the form (Application URL: your site or http://localhost:5173, Application Summary: e.g. "Personal media log").
5. On the API page, copy the "API Key (v3 auth)" and paste it below.`,
  },
  rawg: {
    name: "RAWG (Games)",
    link: "https://rawg.io/apidocs",
    tutorial: `1. Go to rawg.io and sign up or log in.
2. Open the API docs link below and look for "Get your API key" or the signup form.
3. Register for an API key (free tier available).
4. Copy the key from your account/dashboard and paste it below.`,
  },
  bgg: {
    name: "Board Game Geek",
    link: "https://boardgamegeek.com/applications",
    tutorial: `1. Go to boardgamegeek.com and log in (or create an account).
2. Open the Applications link below.
3. Click to create a new application (e.g. "OMNILOG").
4. Choose non-commercial if it's for personal use; submit and wait for approval (can take a few days).
5. Once approved, open your application and create a Token.
6. Copy the Bearer token and paste it below.`,
  },
  ludopedia: {
    name: "Ludopedia",
    link: "https://ludopedia.com.br/api/documentacao.html",
    tutorial: `1. Go to ludopedia.com.br and log in (or create an account).
2. Open Aplicativos (https://www.ludopedia.com.br/aplicativos) and create an application.
3. Use Ludopedia's OAuth flow to obtain an access token (see API documentation).
4. The token is valid for 60 days; paste it below.`,
  },
  comicvine: {
    name: "Comic Vine (Comic books)",
    link: "https://comicvine.gamespot.com/api/",
    tutorial: `1. Go to comicvine.gamespot.com and create a free account or log in.
2. Open the API documentation link below.
3. Request an API key (free) from the Comic Vine API page.
4. Copy your API key and paste it below.`,
  },
} as const;

export type ApiKeyProvider = keyof typeof API_KEY_META;
