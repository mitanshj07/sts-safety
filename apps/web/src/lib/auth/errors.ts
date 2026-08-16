// apps/web/src/lib/auth/errors.ts
import type { UserRole } from "@/lib/auth/roles";

export type AuthErrorCode = "unauthenticated" | "forbidden" | "error";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;
  readonly role: UserRole | null;

  constructor(message: string, status?: number);
  constructor(
    message: string,
    code: AuthErrorCode,
    status: number,
    role?: UserRole | null,
  );
  constructor(
    message: string,
    codeOrStatus: AuthErrorCode | number = "unauthenticated",
    status = 401,
    role: UserRole | null = null,
  ) {
    super(message);
    this.name = "AuthError";
    if (typeof codeOrStatus === "number") {
      this.status = codeOrStatus;
      this.code =
        codeOrStatus === 403
          ? "forbidden"
          : codeOrStatus === 401
            ? "unauthenticated"
            : "error";
      this.role = null;
      return;
    }
    this.code = codeOrStatus;
    this.status = status;
    this.role = role;
  }
}
