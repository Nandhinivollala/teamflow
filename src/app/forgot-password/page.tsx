import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { requestPasswordResetAction } from "./actions";

export const metadata: Metadata = {
  title: "Forgot password | TeamFlow",
  description: "Request a TeamFlow password reset.",
};

const errorMessages: Record<string, string> = {
  email: "Enter a valid email address.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; token?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { error, sent, token } = await searchParams;

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand"><span className="brand-mark">T</span>TeamFlow</div>
        <div>
          <p className="eyebrow">RECOVER ACCESS</p>
          <h1>Reset your TeamFlow password with a one-time link.</h1>
          <p>Enter your email and TeamFlow will prepare a password reset link that expires after one hour.</p>
        </div>
        <small>Secure server-side sessions · Role-based access · Auditable decisions</small>
      </section>
      <section className="login-form-panel">
        <form action={requestPasswordResetAction} className="login-form">
          <div className="login-mobile-brand"><span className="brand-mark">T</span>TeamFlow</div>
          <p className="eyebrow">PASSWORD HELP</p>
          <h2>Forgot your password?</h2>
          <p>We will prepare a one-time reset link for this workspace.</p>
          {error && <div className="login-error" role="alert">{errorMessages[error] ?? "The reset request could not be prepared."}</div>}
          {sent === "1" && (
            <div className="login-success" role="status">
              <p>If the account exists, a one-time reset link is ready.</p>
              {token && (
                <>
                  <p className="reset-note">Email delivery is not configured in this deployment yet, so the link is shown here directly.</p>
                  <Link href={`/reset-password?token=${encodeURIComponent(token)}`}>Continue to reset password</Link>
                </>
              )}
            </div>
          )}
          <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
          <button className="create login-submit" type="submit">Generate reset link →</button>
          <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>
        </form>
      </section>
    </main>
  );
}
