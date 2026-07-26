"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowserClient } from "./supabase";
import styles from "./foundation.module.css";

type Mode = "login" | "signup" | "reset";

export default function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"homeowner" | "contractor">("homeowner");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const supabase = getSupabaseBrowserClient();

    try {
      if (mode === "reset") {
        const { error: resetError } =
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/?recovery=1`,
          });
        if (resetError) throw resetError;
        setMessage(
          "If that account exists, Supabase sent a password-reset email.",
        );
        return;
      }

      if (mode === "signup") {
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              requested_role: role,
            },
          },
        });
        if (signupError) throw signupError;
        if (!data.session) {
          setMessage(
            "Account created. Check your email to confirm it, then return here to sign in.",
          );
        }
        return;
      }

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });
      if (loginError) throw loginError;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Authentication could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.authStory}>
        <Link className={styles.brand} href="/" aria-label="HUM home">
          <span>H</span>
          HUM
        </Link>
        <p className={styles.kicker}>
          Phase 4A · Controlled Humboldt pilot · Secure roofing intelligence
        </p>
        <h1>
          Understand the project
          <em> before the price.</em>
        </h1>
        <p className={styles.authIntro}>
          HUM turns homeowner facts into a versioned, explainable planning
          estimate. The controlled pilot now compares that range with real
          contractor quotes while an isolated QA lane rehearses every role
          without counting test data as real evidence.
        </p>
        <div className={styles.trustGrid}>
          <div>
            <strong>Private by default</strong>
            <span>Project ownership and photo access are enforced on the server.</span>
          </div>
          <div>
            <strong>Money stays deterministic</strong>
            <span>AI interprets language. Approved pricing and code calculate cost.</span>
          </div>
          <div>
            <strong>History stays reproducible</strong>
            <span>Every estimate keeps the exact pricing version and inputs it used.</span>
          </div>
        </div>
        <a className={styles.prototypeLink} href="/prototypes">
          Explore preserved future-workflow prototypes →
        </a>
      </section>

      <section className={styles.authCard} aria-labelledby="auth-title">
        <div className={styles.authTabs} role="tablist">
          <button
            type="button"
            className={mode === "login" ? styles.activeTab : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "signup" ? styles.activeTab : ""}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit}>
          <p className={styles.kicker}>
            {mode === "signup"
              ? "Start a protected workspace"
              : mode === "reset"
                ? "Recover access"
                : "Welcome back"}
          </p>
          <h2 id="auth-title">
            {mode === "signup"
              ? "Create your HUM account"
              : mode === "reset"
                ? "Reset your password"
                : "Open your projects"}
          </h2>

          {mode === "signup" && (
            <>
              <label className={styles.field}>
                <span>Name</span>
                <input
                  required
                  maxLength={120}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <fieldset className={styles.roleField}>
                <legend>Account type</legend>
                <label>
                  <input
                    type="radio"
                    checked={role === "homeowner"}
                    onChange={() => setRole("homeowner")}
                  />
                  <span>
                    <strong>Homeowner</strong>
                    Create projects and planning estimates
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    checked={role === "contractor"}
                    onChange={() => setRole("contractor")}
                  />
                  <span>
                    <strong>Contractor</strong>
                    Review projects explicitly shared with you
                  </span>
                </label>
              </fieldset>
            </>
          )}

          <label className={styles.field}>
            <span>Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          {mode !== "reset" && (
            <label className={styles.field}>
              <span>Password</span>
              <input
                required
                minLength={10}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
              />
              {mode === "signup" && (
                <small>Use at least 10 characters.</small>
              )}
            </label>
          )}

          {error && <p className={styles.formError}>{error}</p>}
          {message && <p className={styles.formSuccess}>{message}</p>}

          <button className={styles.primaryButton} disabled={busy}>
            {busy
              ? "Working…"
              : mode === "signup"
                ? "Create protected account"
                : mode === "reset"
                  ? "Send reset email"
                  : "Sign in"}
          </button>

          {mode === "login" && (
            <button
              className={styles.textButton}
              type="button"
              onClick={() => setMode("reset")}
            >
              Forgot your password?
            </button>
          )}
          {mode === "reset" && (
            <button
              className={styles.textButton}
              type="button"
              onClick={() => setMode("login")}
            >
              Return to sign in
            </button>
          )}
        </form>
        <p className={styles.authBoundary}>
          Planning estimates only. HUM does not provide a binding contractor
          quote, inspection, engineering opinion, or legal advice. Ten real
          projects are still required before Round 5.
        </p>
      </section>
    </main>
  );
}
