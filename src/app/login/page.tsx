import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAction } from "./actions";
import { getCurrentUser } from "@/modules/auth/session";

export const metadata: Metadata = {
  title: "Sign in | TeamFlow",
  description: "Sign in to your TeamFlow workspace.",
};

export default async function LoginPage({
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
          <p className="eyebrow">ENGINEERING, IN FLOW</p>
          <h1>Turn delivery and incident learning into one trusted story.</h1>
          <p>Plan work, understand dependencies, review RCAs, and keep the entire team aligned.</p>
        </div>
        <small>Secure server-side sessions · Role-based access · Auditable decisions</small>
      </section>
      <section className="login-form-panel">
        <form action={loginAction} className="login-form">
          <div className="login-mobile-brand"><span className="brand-mark">T</span>TeamFlow</div>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to TeamFlow</h2>
          <p>Use your workspace credentials to continue.</p>
          {error && <div className="login-error" role="alert">The email or password is incorrect.</div>}
          <label>Email address<input name="email" type="email" required autoComplete="email" defaultValue="manager@teamflow.local" /></label>
          <label>Password<input name="password" type="password" required autoComplete="current-password" defaultValue="Demo1234!" /></label>
          <button className="create login-submit" type="submit">Sign in →</button>
          <div className="demo-credentials"><b>Demo Project Manager</b><span>manager@teamflow.local</span><span>Demo1234!</span></div>
        </form>
      </section>
    </main>
  );
}
