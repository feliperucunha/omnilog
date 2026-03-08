/** Thrown when an external API (TMDB, RAWG, BGG, etc.) returns 401/403 for the provided key. */
export class InvalidApiKeyError extends Error {
  constructor(public readonly provider: string) {
    super(`Invalid API key for provider: ${provider}`);
    this.name = "InvalidApiKeyError";
  }
}
