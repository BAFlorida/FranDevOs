import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { clearSession, getSessionId, getSession } from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;

      // When the session is impersonating, the id of the user being acted as.
      impersonatedUserId?: string | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

// Development-only convenience: when there is no valid session, sign in as a
// privileged user automatically so the app can be worked on in the Replit
// preview without hitting the login screen. This is NEVER active in production
// — published deployments run with NODE_ENV=production, so the live app stays
// fully protected behind email/password.
const DEV_AUTH_BYPASS = process.env.NODE_ENV !== "production";

let loggedDevBypassNotice = false;

async function resolveDevUser(): Promise<AuthUser | null> {
  const users = await db.select().from(usersTable);
  const active = users.filter((u) => u.isActive !== false);
  if (active.length === 0) return null;
  // Prefer the highest-privilege account so the developer can reach every
  // feature: super_admin, then admin, then anyone active.
  const pick =
    active.find((u) => u.role === "super_admin") ??
    active.find((u) => u.role === "admin") ??
    active[0]!;
  return {
    id: pick.id,
    email: pick.email,
    firstName: pick.firstName,
    lastName: pick.lastName,
    profileImageUrl: pick.profileImageUrl,
  };
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session?.user?.id) {
      // req.user is always the real, signed-in identity. Impersonation is
      // resolved downstream in requireAuth using req.impersonatedUserId.
      req.user = session.user;
      req.impersonatedUserId = session.impersonatedUserId ?? undefined;
      next();
      return;
    }
    // Session id present but no longer valid — drop the stale cookie.
    await clearSession(res, sid);
  }

  if (DEV_AUTH_BYPASS) {
    const devUser = await resolveDevUser();
    if (devUser) {
      req.user = devUser;
      req.impersonatedUserId = undefined;
      if (!loggedDevBypassNotice) {
        loggedDevBypassNotice = true;
        req.log.warn(
          { devUserId: devUser.id },
          "DEV auth bypass active — requests are auto-authenticated (NODE_ENV is not production). The published app is unaffected.",
        );
      }
    }
  }

  next();
}
