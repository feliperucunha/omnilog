import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { getAuthCookieName } from "../lib/authCookie.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

export interface AuthPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

function getTokenFromRequest(req: Request): string | null {
  const cookieName = getAuthCookieName();
  const fromCookie = req.cookies?.[cookieName];
  if (fromCookie && typeof fromCookie === "string") return fromCookie;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}

/** Requires valid JWT; responds 401 if missing or invalid. Accepts token from cookie or Authorization header. */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true },
    });
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = { userId: user.id, email: user.email };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

/** Attaches user to req when valid JWT present; does not 401 when missing. */
export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = getTokenFromRequest(req);
  if (!token) {
    next();
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true },
    });
    if (user) req.user = { userId: user.id, email: user.email };
  } catch {
    // ignore invalid token
  }
  next();
};
