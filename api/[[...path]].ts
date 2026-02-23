/**
 * Vercel catch-all: all /api/* requests hit this handler.
 * Reconstruct req.url so Express sees the full path (e.g. /api/auth/register).
 */
// @ts-ignore – built output lives at apps/api/dist
import { app } from "../apps/api/dist/index.js";

export default function handler(req: any, res: any): void {
  const pathSegments = req.query?.path;
  const pathStr =
    Array.isArray(pathSegments) && pathSegments.length > 0
      ? "/api/" + pathSegments.join("/")
      : "/api";
  req.url = pathStr;
  app(req, res);
}
