"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import AuthPanel from "./auth-panel";
import Shell, { type WorkspaceView } from "./shell";
import { getSupabaseBrowserClient } from "./supabase";
import type { Profile } from "./types";
import HomeownerWorkspace from "./homeowner-workspace";
import ContractorWorkspace from "./contractor-workspace";
import AdminWorkspace from "./admin-workspace";
import styles from "./foundation.module.css";
import PilotWorkspace from "./pilot-workspace";
import QaWorkspace from "./qa-workspace";

export default function FoundationApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<WorkspaceView>("projects");
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");

  const loadProfile = useCallback(async (currentSession: Session) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentSession.user.id)
      .single();
    if (error) throw error;
    setProfile(data as Profile);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        try {
          await loadProfile(data.session);
        } catch {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (!nextSession) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setTimeout(() => {
        loadProfile(nextSession)
          .catch(() => setProfile(null))
          .finally(() => setLoading(false));
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    setRecoveryMessage("");
    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password: newPassword,
    });
    if (error) {
      setRecoveryMessage(error.message);
      return;
    }
    setRecoveryMessage("Password updated. Your account is ready.");
    setNewPassword("");
    setRecoveryMode(false);
  }

  if (loading) {
    return <AuthPanel />;
  }

  if (!session) return <AuthPanel />;

  if (recoveryMode) {
    return (
      <main className={styles.recoveryPage}>
        <form className={styles.recoveryCard} onSubmit={updatePassword}>
          <p className={styles.kicker}>Protected account recovery</p>
          <h1>Choose a new password</h1>
          <label className={styles.field}>
            <span>New password</span>
            <input
              required
              minLength={10}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          {recoveryMessage && <p>{recoveryMessage}</p>}
          <button className={styles.primaryButton}>Update password</button>
        </form>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className={styles.recoveryPage}>
        <section className={styles.recoveryCard}>
          <p className={styles.kicker}>Account setup</p>
          <h1>Your profile is still initializing.</h1>
          <p>
            Refresh once. If this continues, sign out and confirm your email
            before signing in again.
          </p>
          <button
            className={styles.primaryButton}
            onClick={() => window.location.reload()}
          >
            Refresh profile
          </button>
        </section>
      </main>
    );
  }

  return (
    <Shell profile={profile} view={view} onView={setView}>
      {profile.role === "homeowner" && (
        <>
          {view === "pilot" ? (
            <PilotWorkspace profile={profile} />
          ) : (
            <HomeownerWorkspace
              profile={profile}
              session={session}
              view={view}
              onView={setView}
            />
          )}
        </>
      )}
      {profile.role === "contractor" && (
        <>
          {view === "pilot" ? (
            <PilotWorkspace profile={profile} />
          ) : (
            <ContractorWorkspace
              profile={profile}
              view={view}
              onView={setView}
            />
          )}
        </>
      )}
      {profile.role === "administrator" && (
        <>
          {view === "qa" ? (
            <QaWorkspace profile={profile} />
          ) : view === "pilot" ? (
            <PilotWorkspace profile={profile} />
          ) : (
            <AdminWorkspace profile={profile} view={view} onView={setView} />
          )}
        </>
      )}
    </Shell>
  );
}
