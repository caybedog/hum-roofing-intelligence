"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Profile } from "./types";
import { getSupabaseBrowserClient } from "./supabase";
import styles from "./foundation.module.css";

export type WorkspaceView =
  | "projects"
  | "intake"
  | "photos"
  | "estimate"
  | "sharing"
  | "pricing"
  | "operations";

export default function Shell({
  profile,
  view,
  onView,
  children,
}: {
  profile: Profile;
  view: WorkspaceView;
  onView: (view: WorkspaceView) => void;
  children: ReactNode;
}) {
  const homeownerItems: Array<[WorkspaceView, string, string]> = [
    ["projects", "Projects", "01"],
    ["intake", "Project intake", "02"],
    ["photos", "Private photos", "03"],
    ["estimate", "Estimate", "04"],
    ["sharing", "Contractor access", "05"],
  ];
  const contractorItems: Array<[WorkspaceView, string, string]> = [
    ["projects", "Shared projects", "01"],
    ["estimate", "Estimate review", "02"],
    ["sharing", "Corrections", "03"],
  ];
  const adminItems: Array<[WorkspaceView, string, string]> = [
    ["projects", "Projects", "01"],
    ["pricing", "Pricing control", "02"],
    ["operations", "Operations", "03"],
  ];
  const items =
    profile.role === "administrator"
      ? adminItems
      : profile.role === "contractor"
        ? contractorItems
        : homeownerItems;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">
          <span>H</span>
          HUM
        </Link>
        <div className={styles.foundationBadge}>
          <span>Roadmap status</span>
          <strong>Round 3 · Foundation recovery</strong>
          <small>Secure intelligence only</small>
        </div>
        <nav aria-label="Workspace">
          {items.map(([key, label, number]) => (
            <button
              key={key}
              type="button"
              className={view === key ? styles.navActive : ""}
              onClick={() => onView(key)}
            >
              <span>{number}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <Link href="/prototypes">Future prototypes ↗</Link>
          <div className={styles.securityMini}>
            <strong>Server-enforced access</strong>
            <span>
              Hiding a button never decides who can read a project.
            </span>
          </div>
          <button
            type="button"
            className={styles.accountButton}
            onClick={() => getSupabaseBrowserClient().auth.signOut()}
          >
            <span>{(profile.full_name ?? profile.email).slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{profile.full_name ?? profile.email}</strong>
              <small>{profile.role} · Sign out</small>
            </span>
          </button>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.mobileHeader}>
          <Link className={styles.brand} href="/">
            <span>H</span>
            HUM
          </Link>
          <select
            aria-label="Workspace section"
            value={view}
            onChange={(event) => onView(event.target.value as WorkspaceView)}
          >
            {items.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </header>
        {children}
      </div>
    </div>
  );
}
