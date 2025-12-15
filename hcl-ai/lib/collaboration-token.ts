import { SignJWT, jwtVerify } from "jose";

const COLLABORATION_TOKEN_EXPIRY = "2h"; // Match session length

/**
 * Get the secret key for signing collaboration tokens.
 * Uses AUTH_SECRET for consistency with NextAuth.
 */
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export interface CollaborationTokenPayload {
  userId: string;
  userName: string;
  canvasId: string;
  iat?: number;
  exp?: number;
}

/**
 * Creates a signed JWT token for Hocuspocus collaboration.
 * This token is verified by the Hocuspocus server to authorize connections.
 */
export async function createCollaborationToken(
  userId: string,
  userName: string,
  canvasId: string
): Promise<string> {
  const token = await new SignJWT({
    userId,
    userName,
    canvasId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(COLLABORATION_TOKEN_EXPIRY)
    .sign(getSecretKey());

  return token;
}

/**
 * Verifies a collaboration token and returns the payload.
 * Returns null if the token is invalid or expired.
 */
export async function verifyCollaborationToken(
  token: string
): Promise<CollaborationTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    return {
      userId: payload.userId as string,
      userName: payload.userName as string,
      canvasId: payload.canvasId as string,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
