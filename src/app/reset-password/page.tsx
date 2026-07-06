import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPasswordResetToken } from "@/modules/auth/password-reset";
import { getCurrentUser } from "@/modules/auth/session";
import { resetPasswordAction } from "./actions";

export const metadata: Metadata = {
  title: "Reset password | TeamFlow",
  description: "Set a new TeamFlow password.",
};

const errorMessages: Record<string, string> = {
  password: "Your password must contain between 8 and 128 characters.",
  mismatch: "The passwords do not match.",
  expired: "This reset link is invalid or has expired. Generate a new one.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; token?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { error, token = "" } = await searchParams;

  if (!token) {
    return (
      <main className="login-page">
        <section className="login-brand-panel">
          <div className="login-brand"><span className="brand-mark">T</span>TeamFlow</div>
          <div>
            <p className="eyebrow">RESET REQUIRED</p>
            <h1>Generate a reset link before choosing a new password.</h1>
            <p>TeamFlow uses one-time reset tokens, so you need to request one first.</p>
          </div>
          <small>Secure server-side sessions · Role-based access · Auditable decisions</small>
        </section>
        <section className="login-form-panel">
          <div className="login-form">
            <div className="login-mobile-brand"><span className="brand-mark">T</span>TeamFlow</div>
            <p className="eyebrow">RESET REQUIRED</p>
            <h2>No reset link found</h2>
            <p>Generate a one-time reset link and come back here to finish setting your new password.</p>
            <div className="auth-switch"><Link href="/forgot-password">Generate reset link</Link></div>
          </div>
        </section>
      </main>
    );
  }

  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { hashedToken: hashPasswordResetToken(token) },
    select: { usedAt: true, expiresAt: true },
  });
  const tokenValid = !!resetRecord && !resetRecord.usedAt && resetRecord.expiresAt > new Date();
  const showExpired = error === "expired" || !tokenValid;

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand"><span className="brand-mark">T</span>TeamFlow</div>
        <div>
          <p className="eyebrow">SET A NEW PASSWORD</p>
          <h1>Choose a new password and get back into your workspace.</h1>
          <p>Your reset link is one-time only and automatically expires after one hour.</p>
        </div>
        <small>Secure server-side sessions · Role-based access · Auditable decisions</small>
      </section>
      <section className="login-form-panel">
        <form action={resetPasswordAction} className="login-form">
          <div className="login-mobile-brand"><span className="brand-mark">T</span>TeamFlow</div>
          <p className="eyebrow">NEW PASSWORD</p>
          <h2>Reset password</h2>
          <p>Create a new password for your TeamFlow account.</p>
          {showExpired && <div className="login-error" role="alert">{errorMessages.expired}</div>}
          {!showExpired && error && <div className="login-error" role="alert">{errorMessages[error] ?? "The password could not be reset."}</div>}
          {!showExpired ? (
            <>
              <input type="hidden" name="token" value={token} />
              <label>
                New password
                <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
                <small className="password-help">Use at least 8 characters.</small>
              </label>
              <label>Confirm password<input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label>
              <button className="create login-submit" type="submit">Reset password →</button>
            </>
          ) : (
            <div className="auth-switch"><Link href="/forgot-password">Generate a new reset link</Link></div>
          )}
          <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>
        </form>
      </section>
    </main>
  );
}
