/** Thrown when an external API is unreachable or repeatedly failing (timeouts/5xx). */
export class UpstreamUnavailableError extends Error {
  constructor(public readonly provider: string) {
    super(`Upstream provider unavailable: ${provider}`);
    this.name = "UpstreamUnavailableError";
  }
}
