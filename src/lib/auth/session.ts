import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "ei_session";
const SESSION_DURATION_DAYS = 30;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookies().delete(SESSION_COOKIE);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let session;
  try {
    session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
  } catch (err) {
    // If the database isn't initialized yet (Prisma P2021), treat the
    // request as unauthenticated rather than crashing the page.
    const code = (err as { code?: string }).code;
    if (code === "P2021" || code === "P1001" || code === "P1003") {
      // eslint-disable-next-line no-console
      console.warn(
        "[session] database unavailable, treating session as anonymous:",
        (err as Error).message,
      );
      return null;
    }
    throw err;
  }

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {
      /* best-effort cleanup */
    });
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    status: session.user.status,
  };
}
