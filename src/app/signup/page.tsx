import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { signupAction } from "./actions";

export const metadata: Metadata = {
  title: "Create account | TeamFlow",
  description: "Create your TeamFlow account.",
};

const errorMessages: Record<string, string> = {
  name: "Enter a name containing between 2 and 80 characters.",
  email: "Enter a valid email address.",
  password: "Your password must contain between 8 and 128 characters.",
  mismatch: "The passwords do not match.",
  exists: "An account already exists for this email. Sign in instead.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand"><span className="brand-mark">T</span>TeamFlow</div>
        <div>
          <p className="eyebrow">START WORKING IN FLOW</p>
          <h1>Bring projects, delivery, and incident learning together.</h1>
          <p>Create your account, start a project, and invite your team when you are ready.</p>
        </div>
        <small>Secure server-side sessions · Role-based access · Auditable decisions</small>
      </section>
      <section className="login-form-panel">
        <form action={signupAction} className="login-form">
          <div className="login-mobile-brand"><span className="brand-mark">T</span>TeamFlow</div>
          <p className="eyebrow">GET STARTED</p>
          <h2>Create your account</h2>
          <p>You can create your first project after signing up.</p>
          {error && <div className="login-error" role="alert">{errorMessages[error] ?? "Your account could not be created."}</div>}
          <label>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
          <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
          <label>
            Password
            <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
            <small className="password-help">Use at least 8 characters.</small>
          </label>
          <label>Confirm password<input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label>
          <button className="create login-submit" type="submit">Create account →</button>
          <div className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></div>
        </form>
      </section>
    </main>
  );
}
