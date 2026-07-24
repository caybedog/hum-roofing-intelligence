"use client";

import { useEffect, useRef, useState } from "react";

type ConstructionRole = "homeowner" | "contractor";
type ConstructionStep = "dashboard" | "schedule" | "field" | "changes" | "payments" | "closeout";
type ChangeStatus = "pending" | "approved" | "declined";
type PaymentStatus = "defined" | "eligible" | "requested" | "approved" | "blocked";

type FieldUpdate = {
  id: string;
  day: string;
  author: string;
  title: string;
  note: string;
  photos: string[];
};

type ProjectMessage = {
  id: string;
  time: string;
  author: string;
  topic: string;
  text: string;
};

type Incident = {
  id: string;
  time: string;
  type: string;
  severity: string;
  impact: string;
  status: string;
};

type ChangeOrder = {
  id: string;
  title: string;
  reason: string;
  scope: string;
  amount: number;
  days: number;
  status: ChangeStatus;
  requestedBy: string;
};

type PaymentRequest = {
  id: string;
  milestone: string;
  amount: number;
  gate: string;
  status: PaymentStatus;
};

type PunchItem = {
  id: string;
  area: string;
  item: string;
  owner: string;
  critical: boolean;
  resolved: boolean;
};

type ActivityEntry = {
  id: string;
  time: string;
  actor: string;
  action: string;
  detail: string;
};

type ConstructionState = {
  role: ConstructionRole;
  step: ConstructionStep;
  milestoneProgress: Record<string, number>;
  fieldUpdates: FieldUpdate[];
  messages: ProjectMessage[];
  incidents: Incident[];
  changeOrders: ChangeOrder[];
  payments: PaymentRequest[];
  punchItems: PunchItem[];
  substantialComplete: boolean;
  activity: ActivityEntry[];
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const milestones = [
  {
    id: "mobilization",
    day: "Day 1 · Aug 24",
    title: "Mobilization and protection",
    responsibility: "Contractor",
    gate: "Staging, landscape protection, permit card, and delivery record",
  },
  {
    id: "tearoff",
    day: "Day 2 · Aug 25",
    title: "Tear-off and decking",
    responsibility: "Contractor + homeowner decision",
    gate: "Decking quantities photographed and any added work approved",
  },
  {
    id: "dryin",
    day: "Day 3 · Aug 26",
    title: "Dry-in and flashing",
    responsibility: "Contractor",
    gate: "Weather-resistant layer, valleys, penetrations, and chimney record",
  },
  {
    id: "roofing",
    day: "Day 4 · Aug 27",
    title: "Roofing system installation",
    responsibility: "Contractor",
    gate: "Named shingles, ridge, vents, and accessories installed to scope",
  },
  {
    id: "finish",
    day: "Day 5 · Aug 28",
    title: "Cleanup and substantial completion",
    responsibility: "Both parties",
    gate: "Inspection, punch list, magnetic sweep, and closeout review",
  },
];

const defaultState: ConstructionState = {
  role: "homeowner",
  step: "dashboard",
  milestoneProgress: {
    mobilization: 100,
    tearoff: 100,
    dryin: 100,
    roofing: 72,
    finish: 0,
  },
  fieldUpdates: [
    {
      id: "update-3",
      day: "Day 3 · 3:42 PM",
      author: "Fictional project manager",
      title: "Dry-in complete before evening fog",
      note: "Synthetic underlayment, valleys, chimney base flashing, and four penetrations are recorded. Intake review is attached to CO-002.",
      photos: ["South plane dry-in", "Chimney flashing", "Decking map"],
    },
    {
      id: "update-2",
      day: "Day 2 · 4:18 PM",
      author: "Fictional project manager",
      title: "Tear-off and decking record",
      note: "Two roof layers were removed. Nine sheets were replaced: seven carried in scope and two documented in CO-001.",
      photos: ["Layer count", "Decking zones", "Disposal ticket"],
    },
    {
      id: "update-1",
      day: "Day 1 · 9:16 AM",
      author: "Fictional project manager",
      title: "Site protection and material check",
      note: "Driveway staging, landscape protection, ladder zones, and fictional material labels were reviewed before work began.",
      photos: ["Staging zone", "Material labels"],
    },
  ],
  messages: [
    {
      id: "message-2",
      time: "Day 3 · 4:03 PM",
      author: "Demo homeowner",
      topic: "Progress",
      text: "I reviewed the dry-in update. Please keep the side gate latched after cleanup.",
    },
    {
      id: "message-1",
      time: "Day 3 · 3:51 PM",
      author: "Fictional project manager",
      topic: "Progress",
      text: "Dry-in is complete. The property is weather-resistant for tonight.",
    },
  ],
  incidents: [
    {
      id: "incident-weather",
      time: "Day 3 · 1:20 PM",
      type: "Weather delay",
      severity: "Low",
      impact: "+0.5 day · $0",
      status: "Plan adjusted",
    },
  ],
  changeOrders: [
    {
      id: "CO-001",
      title: "Two additional decking sheets",
      reason: "Concealed softness beyond the seven-sheet allowance",
      scope: "Remove and replace two 7/16-inch OSB sheets at the locked unit price.",
      amount: 270,
      days: 0.5,
      status: "pending",
      requestedBy: "Fictional project manager",
    },
    {
      id: "CO-002",
      title: "Balanced intake ventilation",
      reason: "Field calculation confirmed insufficient intake",
      scope: "Add the fictional intake correction documented in the ventilation plan.",
      amount: 480,
      days: 0.5,
      status: "approved",
      requestedBy: "Fictional project manager",
    },
  ],
  payments: [
    {
      id: "pay-deposit",
      milestone: "Scheduling deposit",
      amount: 1000,
      gate: "Locked agreement and both demo acknowledgements",
      status: "approved",
    },
    {
      id: "pay-materials",
      milestone: "Materials staged",
      amount: 7588,
      gate: "Named materials and delivery record reviewed",
      status: "approved",
    },
    {
      id: "pay-dryin",
      milestone: "Tear-off and dry-in",
      amount: 7588,
      gate: "Decking record, change decisions, and weather-resistant roof",
      status: "eligible",
    },
    {
      id: "pay-final",
      milestone: "Final completion",
      amount: 5504,
      gate: "Inspection, punch list, cleanup, and closeout documents",
      status: "blocked",
    },
  ],
  punchItems: [
    {
      id: "punch-flashing",
      area: "Chimney",
      item: "Attach final counter-flashing photo after shingle tie-in.",
      owner: "Contractor",
      critical: true,
      resolved: false,
    },
    {
      id: "punch-gutter",
      area: "North eave",
      item: "Correct the slight gutter-guard alignment before walkthrough.",
      owner: "Contractor",
      critical: false,
      resolved: false,
    },
    {
      id: "punch-attic",
      area: "Attic",
      item: "Confirm interior debris check and photograph the access area.",
      owner: "Both parties",
      critical: true,
      resolved: false,
    },
    {
      id: "punch-property",
      area: "Property",
      item: "Landscape protection and driveway condition reviewed.",
      owner: "Homeowner",
      critical: false,
      resolved: true,
    },
  ],
  substantialComplete: false,
  activity: [
    {
      id: "activity-5",
      time: "Day 3 · 4:03 PM",
      actor: "Demo homeowner",
      action: "Message added",
      detail: "Side-gate cleanup reminder recorded under Progress.",
    },
    {
      id: "activity-4",
      time: "Day 3 · 3:42 PM",
      actor: "Fictional project manager",
      action: "Milestone updated",
      detail: "Dry-in milestone marked complete with three fictional photo records.",
    },
    {
      id: "activity-3",
      time: "Day 3 · 1:20 PM",
      actor: "Fictional project manager",
      action: "Delay logged",
      detail: "Coastal moisture added 0.5 day with no price effect.",
    },
    {
      id: "activity-2",
      time: "Day 2 · 4:22 PM",
      actor: "Fictional project manager",
      action: "Change order created",
      detail: "CO-001 records two additional decking sheets at $270.",
    },
    {
      id: "activity-1",
      time: "Day 1 · 9:16 AM",
      actor: "Fictional project manager",
      action: "Construction started",
      detail: "Mobilization and property-protection record opened.",
    },
  ],
};

const safeHydrate = (value: unknown): ConstructionState => {
  if (!value || typeof value !== "object") return defaultState;
  const candidate = value as Partial<ConstructionState>;
  return {
    ...defaultState,
    ...candidate,
    role: candidate.role === "contractor" ? "contractor" : "homeowner",
    step: ["dashboard", "schedule", "field", "changes", "payments", "closeout"].includes(candidate.step ?? "")
      ? candidate.step as ConstructionStep
      : "dashboard",
    milestoneProgress: {
      ...defaultState.milestoneProgress,
      ...(candidate.milestoneProgress ?? {}),
    },
    fieldUpdates: Array.isArray(candidate.fieldUpdates) ? candidate.fieldUpdates : defaultState.fieldUpdates,
    messages: Array.isArray(candidate.messages) ? candidate.messages : defaultState.messages,
    incidents: Array.isArray(candidate.incidents) ? candidate.incidents : defaultState.incidents,
    changeOrders: Array.isArray(candidate.changeOrders) ? candidate.changeOrders : defaultState.changeOrders,
    payments: Array.isArray(candidate.payments) ? candidate.payments : defaultState.payments,
    punchItems: Array.isArray(candidate.punchItems) ? candidate.punchItems : defaultState.punchItems,
    activity: Array.isArray(candidate.activity) ? candidate.activity : defaultState.activity,
  };
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;

export default function ConstructionWorkspace() {
  const [project, setProject] = useState<ConstructionState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [syncState, setSyncState] = useState<"loading" | "saved" | "saving" | "session">("loading");
  const [updateDraft, setUpdateDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [messageTopic, setMessageTopic] = useState("Progress");
  const [notice, setNotice] = useState("");
  const hydrationStarted = useRef(false);
  const persistenceDisabled = useRef(false);

  useEffect(() => {
    if (hydrationStarted.current) return;
    hydrationStarted.current = true;
    let active = true;

    fetch("/api/construction", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Persistence unavailable");
        return response.json() as Promise<{ state?: unknown }>;
      })
      .then((payload) => {
        if (!active) return;
        if (payload.state) setProject(safeHydrate(payload.state));
        setSyncState("saved");
      })
      .catch(() => {
        if (!active) return;
        persistenceDisabled.current = true;
        setSyncState("session");
      })
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || persistenceDisabled.current) return;
    setSyncState("saving");
    const timer = window.setTimeout(() => {
      fetch("/api/construction", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: project }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Save failed");
          setSyncState("saved");
        })
        .catch(() => {
          persistenceDisabled.current = true;
          setSyncState("session");
        });
    }, 550);

    return () => window.clearTimeout(timer);
  }, [hydrated, project]);

  const roleName = project.role === "homeowner" ? "Demo homeowner" : "Fictional project manager";
  const progress = Math.round(
    Object.values(project.milestoneProgress).reduce((sum, value) => sum + value, 0) /
      milestones.length,
  );
  const approvedChanges = project.changeOrders.filter((item) => item.status === "approved");
  const pendingChanges = project.changeOrders.filter((item) => item.status === "pending");
  const approvedChangeTotal = approvedChanges.reduce((sum, item) => sum + item.amount, 0);
  const pendingExposure = pendingChanges.reduce((sum, item) => sum + item.amount, 0);
  const revisedContract = 21680 + approvedChangeTotal;
  const scheduleVariance = approvedChanges.reduce((sum, item) => sum + item.days, 0) +
    project.incidents.reduce((sum, item) => sum + (item.impact.includes("+0.5 day") ? 0.5 : 0), 0);
  const unresolvedPunch = project.punchItems.filter((item) => !item.resolved);
  const openCriticalPunch = unresolvedPunch.filter((item) => item.critical);
  const outstandingDecisions = pendingChanges.length +
    project.payments.filter((payment) => payment.status === "requested").length +
    openCriticalPunch.length;
  const paymentsAhead = project.payments.some((payment) => {
    if (payment.status !== "approved") return false;
    if (payment.id === "pay-dryin") return project.milestoneProgress.dryin < 100;
    if (payment.id === "pay-final") return project.milestoneProgress.finish < 95;
    return false;
  });
  const substantialReady =
    progress >= 95 &&
    pendingChanges.length === 0 &&
    openCriticalPunch.length === 0 &&
    !paymentsAhead;

  const persistLabel =
    syncState === "loading" ? "Loading saved record" :
    syncState === "saving" ? "Saving protected record" :
    syncState === "saved" ? "Saved to this protected workspace" :
    "Session-only preview";

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4200);
  };

  const record = (
    action: string,
    detail: string,
    transform?: (current: ConstructionState) => ConstructionState,
  ) => {
    setProject((current) => {
      const changed = transform ? transform(current) : current;
      return {
        ...changed,
        activity: [
          {
            id: makeId("activity"),
            time: "Recorded just now",
            actor: current.role === "homeowner" ? "Demo homeowner" : "Fictional project manager",
            action,
            detail,
          },
          ...changed.activity,
        ],
      };
    });
  };

  const chooseStep = (step: ConstructionStep) => {
    setProject((current) => ({ ...current, step }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeRole = (role: ConstructionRole) => {
    setProject((current) => ({ ...current, role }));
    showNotice(`Showing the ${role} controls. This role switch is only a protected demo preview.`);
  };

  const advanceMilestone = (id: string) => {
    if (project.role !== "contractor") return;
    const currentValue = project.milestoneProgress[id] ?? 0;
    const nextValue = Math.min(100, currentValue + 25);
    record(
      "Milestone updated",
      `${milestones.find((milestone) => milestone.id === id)?.title ?? id} moved from ${currentValue}% to ${nextValue}%.`,
      (current) => ({
        ...current,
        milestoneProgress: { ...current.milestoneProgress, [id]: nextValue },
      }),
    );
    showNotice("Fictional field progress updated. No construction activity was triggered.");
  };

  const addFieldUpdate = () => {
    const note = updateDraft.trim();
    if (!note || project.role !== "contractor") return;
    const update: FieldUpdate = {
      id: makeId("update"),
      day: "Recorded just now",
      author: "Fictional project manager",
      title: "Contractor field update",
      note,
      photos: ["Fictional progress record"],
    };
    record(
      "Field update added",
      note,
      (current) => ({ ...current, fieldUpdates: [update, ...current.fieldUpdates] }),
    );
    setUpdateDraft("");
    showNotice("Field update saved inside the sandbox. Nothing was messaged externally.");
  };

  const addMessage = () => {
    const text = messageDraft.trim();
    if (!text) return;
    const message: ProjectMessage = {
      id: makeId("message"),
      time: "Recorded just now",
      author: roleName,
      topic: messageTopic,
      text,
    };
    record(
      "Project message recorded",
      `${messageTopic}: ${text}`,
      (current) => ({ ...current, messages: [message, ...current.messages] }),
    );
    setMessageDraft("");
    showNotice("Message added to the internal demo thread. Nothing was sent to a real person.");
  };

  const addSafetyIncident = () => {
    if (project.incidents.some((item) => item.id === "incident-access")) return;
    const incident: Incident = {
      id: "incident-access",
      time: "Recorded just now",
      type: "Access and safety",
      severity: "Medium",
      impact: "Side-gate route paused · $0",
      status: "Protection reset",
    };
    record(
      "Incident logged",
      "Side-gate route paused until the protection barrier was reset.",
      (current) => ({ ...current, incidents: [incident, ...current.incidents] }),
    );
    showNotice("Sample incident recorded with schedule and cost impact.");
  };

  const decideChange = (id: string, status: ChangeStatus) => {
    if (project.role !== "homeowner") return;
    const item = project.changeOrders.find((change) => change.id === id);
    if (!item) return;
    record(
      status === "approved" ? "Change order approved in demo" : "Change order declined in demo",
      `${id} · ${item.title} · ${money(item.amount)} · ${item.days} day impact.`,
      (current) => ({
        ...current,
        changeOrders: current.changeOrders.map((change) =>
          change.id === id ? { ...change, status } : change,
        ),
      }),
    );
    showNotice(`${id} marked ${status}. This is not a real approval or authorization.`);
  };

  const addSampleChange = () => {
    if (project.role !== "contractor" || project.changeOrders.some((item) => item.id === "CO-003")) return;
    const change: ChangeOrder = {
      id: "CO-003",
      title: "Replace one damaged fascia section",
      reason: "Concealed rot became visible after edge-metal removal",
      scope: "Replace eight linear feet, prime cut ends, and restore edge-metal attachment.",
      amount: 420,
      days: 0.5,
      status: "pending",
      requestedBy: "Fictional project manager",
    };
    record(
      "Change order created",
      "CO-003 records eight feet of fictional fascia repair for homeowner review.",
      (current) => ({ ...current, changeOrders: [...current.changeOrders, change] }),
    );
    showNotice("Written sample change order created. Work is not authorized.");
  };

  const requestPayment = (id: string) => {
    if (project.role !== "contractor") return;
    const payment = project.payments.find((item) => item.id === id);
    if (!payment || payment.status !== "eligible") return;
    record(
      "Payment request opened",
      `${payment.milestone} · ${money(payment.amount)} · no funds moved.`,
      (current) => ({
        ...current,
        payments: current.payments.map((item) =>
          item.id === id ? { ...item, status: "requested" } : item,
        ),
      }),
    );
    showNotice("Sandbox payment request opened. No processor or bank was contacted.");
  };

  const approvePayment = (id: string) => {
    if (project.role !== "homeowner") return;
    const payment = project.payments.find((item) => item.id === id);
    if (!payment || payment.status !== "requested") return;
    record(
      "Payment gate approved in demo",
      `${payment.milestone} · ${money(payment.amount)} · $0 transferred.`,
      (current) => ({
        ...current,
        payments: current.payments.map((item) =>
          item.id === id ? { ...item, status: "approved" } : item,
        ),
      }),
    );
    showNotice("Payment gate approved in the demo ledger. No funds were transferred.");
  };

  const togglePunchItem = (id: string) => {
    const item = project.punchItems.find((entry) => entry.id === id);
    if (!item) return;
    const next = !item.resolved;
    record(
      next ? "Punch item resolved" : "Punch item reopened",
      `${item.area}: ${item.item}`,
      (current) => ({
        ...current,
        punchItems: current.punchItems.map((entry) =>
          entry.id === id ? { ...entry, resolved: next } : entry,
        ),
      }),
    );
  };

  const loadSubstantialCompletion = () => {
    record(
      "Substantial-completion sample loaded",
      "Construction milestones moved to a reviewable completion state; final closeout remains open.",
      (current) => ({
        ...current,
        step: "closeout",
        milestoneProgress: {
          mobilization: 100,
          tearoff: 100,
          dryin: 100,
          roofing: 100,
          finish: 95,
        },
        changeOrders: current.changeOrders.map((item) =>
          item.status === "pending" ? { ...item, status: "approved" as const } : item,
        ),
        payments: current.payments.map((item) =>
          item.id === "pay-dryin" && item.status !== "approved"
            ? { ...item, status: "eligible" as const }
            : item,
        ),
      }),
    );
    showNotice("Substantial-completion sample loaded. Review and clear the remaining punch items.");
  };

  const markSubstantialComplete = () => {
    if (!substantialReady) return;
    record(
      "Substantial completion recorded",
      "The fictional project reached substantial completion; final inspection, closeout, warranty, and performance review remain open.",
      (current) => ({ ...current, substantialComplete: true }),
    );
    showNotice("Substantial completion recorded in this demo. Final closeout is still pending.");
  };

  const downloadConstructionRecord = () => {
    const lines = [
      "HUM ACTIVE-CONSTRUCTION RECORD",
      "Fictional demonstration · No real message, payment, approval, photo, or construction action",
      "",
      `Workspace role preview: ${project.role}`,
      `Overall progress: ${progress}%`,
      `Base agreement: ${money(21680)}`,
      `Approved demo changes: ${money(approvedChangeTotal)}`,
      `Current demo budget: ${money(revisedContract)}`,
      `Pending exposure: ${money(pendingExposure)}`,
      `Schedule effect recorded: +${scheduleVariance} day`,
      `Substantial completion: ${project.substantialComplete ? "Recorded in demo" : "Pending"}`,
      "",
      "MILESTONES",
      ...milestones.map((milestone) => `${milestone.title}: ${project.milestoneProgress[milestone.id]}% | ${milestone.gate}`),
      "",
      "CHANGE ORDERS",
      ...project.changeOrders.map((item) => `${item.id} · ${item.status.toUpperCase()} · ${item.title} · ${money(item.amount)} · +${item.days} day`),
      "",
      "PAYMENT GATES",
      ...project.payments.map((item) => `${item.milestone}: ${item.status.toUpperCase()} · ${money(item.amount)} · $0 transferred`),
      "",
      "PUNCH LIST",
      ...project.punchItems.map((item) => `${item.resolved ? "[RESOLVED]" : "[OPEN]"} ${item.area}: ${item.item}`),
      "",
      "ACTIVITY HISTORY",
      ...project.activity.map((item) => `${item.time} · ${item.actor} · ${item.action}: ${item.detail}`),
      "",
      "Construction tracked through substantial completion—final closeout and performance review remain pending.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "HUM-active-construction-record.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showNotice("Demo construction record downloaded. It is not a payment or authorization record.");
  };

  const healthCards = [
    {
      label: "Schedule",
      value: `${progress}%`,
      detail: `Day 3 of 5 · +${scheduleVariance} day recorded`,
      tone: progress >= 95 ? "clear" : "progress",
    },
    {
      label: "Budget",
      value: money(revisedContract),
      detail: `${money(pendingExposure)} pending exposure`,
      tone: pendingExposure ? "review" : "clear",
    },
    {
      label: "Protection",
      value: paymentsAhead ? "At risk" : "Aligned",
      detail: "$0 transferred in this sandbox",
      tone: paymentsAhead ? "critical" : "clear",
    },
    {
      label: "Decisions",
      value: String(outstandingDecisions),
      detail: "Change, payment, and critical punch decisions",
      tone: outstandingDecisions ? "review" : "clear",
    },
  ];

  return (
    <div className="construction-workspace">
      {notice && <div className="construction-notice" role="status">{notice}</div>}

      <section className="page-heading split-heading construction-heading">
        <div>
          <span className="eyebrow copper">Round 8 · Active construction</span>
          <h1>Keep the project visible<br />while the work moves.</h1>
          <p>HUM connects schedule, field records, decisions, payment gates, and issues without allowing progress or money to outrun verified work.</p>
        </div>
        <div className="construction-role-card">
          <span className="eyebrow light">Role-aware preview</span>
          <strong>{project.role === "homeowner" ? "Homeowner view" : "Contractor view"}</strong>
          <div>
            <button className={project.role === "homeowner" ? "active" : ""} onClick={() => changeRole("homeowner")}>Homeowner</button>
            <button className={project.role === "contractor" ? "active" : ""} onClick={() => changeRole("contractor")}>Contractor</button>
          </div>
          <small>Role preview changes the available controls. It does not grant another person access.</small>
        </div>
      </section>

      <section className="construction-project-bar">
        <div><span>Project</span><strong>Sample residence · Project 001</strong></div>
        <div><span>Contractor</span><strong>Redwood Roofworks · fictional</strong></div>
        <div><span>Agreement</span><strong>Version 2 · {money(21680)}</strong></div>
        <div><span>Working state</span><strong>{project.substantialComplete ? "Substantial completion" : "Construction active"}</strong></div>
        <span className={`sync-pill ${syncState}`}>{persistLabel}</span>
      </section>

      <nav className="construction-tabs" aria-label="Active construction workflow">
        {[
          ["dashboard", "01", "Project health"],
          ["schedule", "02", "Schedule"],
          ["field", "03", "Field + messages"],
          ["changes", "04", "Change orders"],
          ["payments", "05", "Payment gates"],
          ["closeout", "06", "Punch + completion"],
        ].map(([key, number, label]) => (
          <button
            key={key}
            className={project.step === key ? "active" : ""}
            onClick={() => chooseStep(key as ConstructionStep)}
          >
            <span>{number}</span>{label}
          </button>
        ))}
      </nav>

      {project.step === "dashboard" && (
        <>
          <section className="construction-health">
            <div className="construction-score">
              <span className="eyebrow light">Verified progress</span>
              <strong>{progress}<small>%</small></strong>
              <p>{project.substantialComplete ? "Substantial completion recorded." : "Work is through dry-in and partway through the roofing system."}</p>
            </div>
            <div className="health-card-grid">
              {healthCards.map((card) => (
                <article key={card.label} className={card.tone}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block construction-today">
            <div>
              <span className="eyebrow light">Today · Day 3</span>
              <h2>The roof is dry. Three decisions remain visible.</h2>
              <p>Dry-in is complete, one decking change awaits homeowner review, and the next eligible payment gate has not moved any money.</p>
            </div>
            <div className="today-actions">
              <button onClick={() => chooseStep("changes")}><span>01</span><strong>Review CO-001</strong><small>{money(270)} · +0.5 day</small></button>
              <button onClick={() => chooseStep("payments")}><span>02</span><strong>Review dry-in gate</strong><small>{money(7588)} · $0 moved</small></button>
              <button onClick={() => chooseStep("field")}><span>03</span><strong>Read latest update</strong><small>3 fictional records</small></button>
            </div>
          </section>

          <section className="construction-grid section-block">
            <div className="activity-card">
              <div className="section-title"><div><span className="eyebrow">Permanent activity history</span><h2>Who changed what</h2></div><span className="step-count">{project.activity.length} records</span></div>
              <div className="activity-list">
                {project.activity.slice(0, 7).map((entry) => (
                  <div key={entry.id}>
                    <span>{entry.time}</span>
                    <i />
                    <div><small>{entry.actor}</small><strong>{entry.action}</strong><p>{entry.detail}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <aside className="construction-risks">
              <span className="eyebrow">Current attention</span>
              <h2>Nothing important disappears inside a text thread.</h2>
              <div><b>Decision</b><strong>CO-001 needs homeowner action</strong><span>{money(270)} · two additional decking sheets</span></div>
              <div><b>Schedule</b><strong>Coastal moisture added 0.5 day</strong><span>No price effect recorded</span></div>
              <div><b>Next inspection</b><strong>Dry-in record ready</strong><span>Permit inspection remains fictional</span></div>
              <button onClick={() => chooseStep("schedule")}>Open schedule and incidents <span>→</span></button>
            </aside>
          </section>

          <section className="construction-boundary">
            <div><strong>Protected in this round</strong><span>Project state, role-specific controls, chronology, written decisions, progress gates, and a $0 payment ledger.</span></div>
            <div><strong>Still sandboxed</strong><span>No external message, uploaded photo, payment, permit action, legal approval, or real construction instruction leaves HUM.</span></div>
          </section>
        </>
      )}

      {project.step === "schedule" && (
        <>
          <section className="construction-intro">
            <div><span className="eyebrow">Live schedule</span><h2>Progress has an owner, a gate, and evidence.</h2></div>
            <p>{project.role === "contractor" ? "Contractor preview can update fictional field progress." : "Homeowner preview can inspect progress but cannot change contractor-reported percentages."}</p>
          </section>

          <section className="milestone-board">
            {milestones.map((milestone, index) => {
              const value = project.milestoneProgress[milestone.id] ?? 0;
              return (
                <article key={milestone.id} className={value === 100 ? "complete" : value > 0 ? "active" : ""}>
                  <div className="milestone-number">{String(index + 1).padStart(2, "0")}</div>
                  <div className="milestone-copy">
                    <span>{milestone.day}</span>
                    <h3>{milestone.title}</h3>
                    <p>{milestone.gate}</p>
                    <small>Owner · {milestone.responsibility}</small>
                  </div>
                  <div className="milestone-progress">
                    <strong>{value}%</strong>
                    <div><i style={{ width: `${value}%` }} /></div>
                    <button disabled={project.role !== "contractor" || value === 100} onClick={() => advanceMilestone(milestone.id)}>
                      {value === 100 ? "Complete" : project.role === "contractor" ? "Advance demo progress" : "Contractor control"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="incident-layout section-block">
            <div className="incident-register">
              <div className="section-title"><div><span className="eyebrow">Delay and incident register</span><h2>Every impact stays attached</h2></div><span className="step-count">{project.incidents.length} records</span></div>
              <div className="incident-row incident-head"><span>Time</span><span>Type</span><span>Severity</span><span>Impact</span><span>Status</span></div>
              {project.incidents.map((incident) => (
                <div className="incident-row" key={incident.id}>
                  <span>{incident.time}</span><strong>{incident.type}</strong><b>{incident.severity}</b><span>{incident.impact}</span><span>{incident.status}</span>
                </div>
              ))}
            </div>
            <aside className="incident-action">
              <span className="eyebrow light">Structured reporting</span>
              <h2>Log impact before the story changes.</h2>
              <p>A real report would capture evidence, affected work, immediate controls, owners, cost, schedule, and required follow-up.</p>
              <button disabled={project.role !== "contractor" || project.incidents.some((item) => item.id === "incident-access")} onClick={addSafetyIncident}>
                {project.incidents.some((item) => item.id === "incident-access") ? "Sample incident recorded" : project.role === "contractor" ? "Add sample access incident" : "Switch to contractor view"}
              </button>
            </aside>
          </section>

          <div className="bottom-actions"><button className="secondary-button" onClick={() => chooseStep("dashboard")}>Back to project health</button><button className="primary-button" onClick={() => chooseStep("field")}>Open field records</button></div>
        </>
      )}

      {project.step === "field" && (
        <>
          <section className="construction-intro">
            <div><span className="eyebrow">Field records and messaging</span><h2>Updates stay connected to the project.</h2></div>
            <p>Photo tiles below are labeled fictional records, not uploads. Messages remain inside this protected sandbox and are never delivered externally.</p>
          </section>

          <section className="field-layout">
            <div className="field-feed">
              {project.fieldUpdates.map((update) => (
                <article key={update.id}>
                  <div className="field-meta"><span>{update.day}</span><small>{update.author}</small></div>
                  <h3>{update.title}</h3>
                  <p>{update.note}</p>
                  <div className="photo-records">
                    {update.photos.map((photo, index) => (
                      <div key={`${update.id}-${photo}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{photo}</strong><small>Fictional photo record</small></div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <aside className="field-composer">
              <span className="eyebrow light">Contractor field update</span>
              <h2>Record the work before leaving site.</h2>
              <textarea value={updateDraft} onChange={(event) => setUpdateDraft(event.target.value)} rows={7} placeholder="Describe completed work, conditions, decisions, and what happens next." />
              <button disabled={project.role !== "contractor" || !updateDraft.trim()} onClick={addFieldUpdate}>{project.role === "contractor" ? "Add sandbox update" : "Switch to contractor view"}</button>
              <small>No image upload or external notification occurs.</small>
            </aside>
          </section>

          <section className="message-workspace section-block">
            <div className="message-thread">
              <div className="section-title"><div><span className="eyebrow">Project messages</span><h2>Organized by topic</h2></div><span className="step-count">{project.messages.length} messages</span></div>
              {project.messages.map((message) => (
                <div key={message.id} className={message.author === "Demo homeowner" ? "homeowner" : "contractor"}>
                  <div><strong>{message.author}</strong><span>{message.time}</span></div>
                  <b>{message.topic}</b>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
            <div className="message-composer">
              <label>Topic
                <select value={messageTopic} onChange={(event) => setMessageTopic(event.target.value)}>
                  <option>Progress</option>
                  <option>Access</option>
                  <option>Materials</option>
                  <option>Change order</option>
                  <option>Payment gate</option>
                  <option>Punch list</option>
                </select>
              </label>
              <label>Message
                <textarea value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} rows={6} placeholder="Write a project-specific demo message." />
              </label>
              <button disabled={!messageDraft.trim()} onClick={addMessage}>Add to internal demo thread</button>
              <small>This does not send a text, email, push notification, or contractor message.</small>
            </div>
          </section>

          <div className="bottom-actions"><button className="secondary-button" onClick={() => chooseStep("schedule")}>Back to schedule</button><button className="primary-button" onClick={() => chooseStep("changes")}>Review change orders</button></div>
        </>
      )}

      {project.step === "changes" && (
        <>
          <section className="construction-intro">
            <div><span className="eyebrow">Written change orders</span><h2>Changed work cannot hide inside a conversation.</h2></div>
            <p>Every change shows the discovered condition, scope, price, schedule effect, status, and decision owner before changed work appears authorized.</p>
          </section>

          <section className="change-summary">
            <div><span>Original agreement</span><strong>{money(21680)}</strong></div>
            <div><span>Approved changes</span><strong>+{money(approvedChangeTotal)}</strong></div>
            <div><span>Current demo budget</span><strong>{money(revisedContract)}</strong></div>
            <div><span>Pending exposure</span><strong>{money(pendingExposure)}</strong></div>
            <div><span>Schedule effect</span><strong>+{scheduleVariance} day</strong></div>
          </section>

          <section className="construction-change-list section-block">
            {project.changeOrders.map((change) => (
              <article key={change.id} className={change.status}>
                <div className="change-id">
                  <span>{change.id}</span>
                  <b>{change.status}</b>
                </div>
                <div className="change-body">
                  <small>Requested by {change.requestedBy}</small>
                  <h3>{change.title}</h3>
                  <p><strong>Discovered condition</strong>{change.reason}</p>
                  <p><strong>Written scope</strong>{change.scope}</p>
                </div>
                <div className="change-impact">
                  <span><small>Price effect</small><strong>+{money(change.amount)}</strong></span>
                  <span><small>Schedule effect</small><strong>+{change.days} day</strong></span>
                  {change.status === "pending" && project.role === "homeowner" ? (
                    <div><button onClick={() => decideChange(change.id, "declined")}>Decline demo change</button><button className="approve" onClick={() => decideChange(change.id, "approved")}>Approve in demo</button></div>
                  ) : (
                    <em>{change.status === "pending" ? "Homeowner decision required" : `${change.status} in sandbox`}</em>
                  )}
                </div>
              </article>
            ))}
          </section>

          <section className="new-change-card">
            <div><span className="eyebrow light">Contractor control</span><h2>Create a complete change record.</h2><p>The sample demonstrates a written fascia-repair request. It cannot authorize or begin work.</p></div>
            <button disabled={project.role !== "contractor" || project.changeOrders.some((item) => item.id === "CO-003")} onClick={addSampleChange}>
              {project.changeOrders.some((item) => item.id === "CO-003") ? "CO-003 added" : project.role === "contractor" ? "Create sample CO-003" : "Switch to contractor view"}
            </button>
          </section>

          <section className="change-protection">
            <strong>Protection rule</strong>
            <span>Pending or declined changes do not enter the approved budget, completion evidence, or payment eligibility. Every demo action remains reversible and nonbinding.</span>
          </section>

          <div className="bottom-actions"><button className="secondary-button" onClick={() => chooseStep("field")}>Back to field records</button><button className="primary-button" onClick={() => chooseStep("payments")}>Review payment protection</button></div>
        </>
      )}

      {project.step === "payments" && (
        <>
          <section className="construction-intro">
            <div><span className="eyebrow">Progress-to-payment protection</span><h2>Money never appears ahead of completed work.</h2></div>
            <p>These are sandbox requests and approvals only. HUM records eligibility and receipts as workflow states while every actual transfer remains exactly $0.</p>
          </section>

          <section className={`payment-protection-banner ${paymentsAhead ? "risk" : "clear"}`}>
            <div><span className="eyebrow light">Protection check</span><h2>{paymentsAhead ? "An approved gate is ahead of verified progress." : "Payment gates align with recorded progress."}</h2><p>{paymentsAhead ? "Reopen the affected gate before continuing." : "Dry-in is eligible because tear-off, decking, and weather protection are recorded complete."}</p></div>
            <div><strong>$0</strong><span>actually transferred</span></div>
          </section>

          <section className="construction-payments section-block">
            {project.payments.map((payment, index) => {
              const canRequest = project.role === "contractor" && payment.status === "eligible";
              const canApprove = project.role === "homeowner" && payment.status === "requested";
              return (
                <article key={payment.id} className={payment.status}>
                  <div><span>{String(index + 1).padStart(2, "0")}</span><b>{payment.status}</b></div>
                  <small>Fictional milestone</small>
                  <h3>{payment.milestone}</h3>
                  <strong>{money(payment.amount)}</strong>
                  <p>{payment.gate}</p>
                  <dl>
                    <div><dt>Processor</dt><dd>Not connected</dd></div>
                    <div><dt>Funds moved</dt><dd>$0</dd></div>
                    <div><dt>Receipt</dt><dd>{payment.status === "approved" ? "Demo record only" : "None"}</dd></div>
                  </dl>
                  {canRequest && <button onClick={() => requestPayment(payment.id)}>Open sandbox request</button>}
                  {canApprove && <button onClick={() => approvePayment(payment.id)}>Approve gate · move $0</button>}
                  {!canRequest && !canApprove && <button disabled>{payment.status === "blocked" ? "Progress gate not met" : payment.status === "approved" ? "Demo approval recorded" : project.role === "homeowner" ? "Awaiting contractor request" : "Awaiting homeowner review"}</button>}
                </article>
              );
            })}
          </section>

          <section className="payment-ledger">
            <div className="section-title"><div><span className="eyebrow">Receipt and approval register</span><h2>Workflow evidence without pretending money moved</h2></div><span className="step-count">$0 transferred</span></div>
            {project.payments.map((payment) => (
              <div key={payment.id}><strong>{payment.milestone}</strong><span>{payment.status}</span><span>{money(payment.amount)}</span><span>$0 moved</span><span>{payment.status === "approved" ? "Demo record" : "No receipt"}</span></div>
            ))}
          </section>

          <div className="bottom-actions"><button className="secondary-button" onClick={() => chooseStep("changes")}>Back to change orders</button><button className="primary-button" onClick={() => chooseStep("closeout")}>Open punch and completion</button></div>
        </>
      )}

      {project.step === "closeout" && (
        <>
          <section className="construction-intro">
            <div><span className="eyebrow">Punch list and substantial completion</span><h2>Finish the work before finishing the project.</h2></div>
            <p>Round 8 ends at substantial completion. Final inspection, final payment, lien and warranty documents, performance review, and dispute windows stay for Round 9.</p>
          </section>

          <section className="completion-overview">
            <div className="completion-progress">
              <span className="eyebrow light">Completion gate</span>
              <strong>{progress}<small>%</small></strong>
              <p>{substantialReady ? "Schedule, critical punch items, changes, and payment protection are ready." : `${pendingChanges.length + openCriticalPunch.length} critical decision${pendingChanges.length + openCriticalPunch.length === 1 ? "" : "s"} plus remaining progress keep the gate protected.`}</p>
            </div>
            <div className="completion-gates">
              {[
                ["Progress at 95% or higher", progress >= 95],
                ["No pending change orders", pendingChanges.length === 0],
                ["Critical punch items resolved", openCriticalPunch.length === 0],
                ["Payments not ahead of progress", !paymentsAhead],
              ].map(([label, ready]) => (
                <div key={label as string} className={ready ? "ready" : ""}><span>{ready ? "✓" : "!"}</span><strong>{label as string}</strong><small>{ready ? "Clear" : "Open"}</small></div>
              ))}
              <button onClick={loadSubstantialCompletion}>Load substantial-completion sample</button>
            </div>
          </section>

          <section className="punch-list section-block">
            <div className="section-title"><div><span className="eyebrow">Homeowner punch list</span><h2>Open corrections stay visible</h2></div><span className="step-count">{unresolvedPunch.length} open</span></div>
            <div className="punch-row punch-head"><span>Area</span><span>Item</span><span>Owner</span><span>Priority</span><span>Status</span></div>
            {project.punchItems.map((item) => (
              <button className={`punch-row ${item.resolved ? "resolved" : ""}`} key={item.id} onClick={() => togglePunchItem(item.id)}>
                <strong>{item.area}</strong><span>{item.item}</span><span>{item.owner}</span><b>{item.critical ? "Critical" : "Standard"}</b><em>{item.resolved ? "Resolved ✓" : "Mark resolved"}</em>
              </button>
            ))}
          </section>

          {!project.substantialComplete ? (
            <section className="substantial-action">
              <div><span className="eyebrow light">Round 8 final checkpoint</span><h2>{substantialReady ? "Record fictional substantial completion." : "The project is not ready to cross the gate."}</h2><p>{substantialReady ? "This changes only the protected demo record. Final closeout and performance review remain pending." : "Complete work, resolve pending changes and critical punch items, and keep payment gates behind verified progress."}</p></div>
              <button disabled={!substantialReady} onClick={markSubstantialComplete}>{substantialReady ? "Mark substantial completion" : `${progress}% · gates remain`}</button>
            </section>
          ) : (
            <section className="substantial-complete-banner">
              <div><span className="eyebrow light">Round 8 complete</span><h2>Construction tracked through substantial completion—final closeout and performance review remain pending.</h2><p>HUM preserves the schedule, field record, messages, incidents, change decisions, payment gates, punch list, and activity history in one protected demo record.</p></div>
              <button onClick={downloadConstructionRecord}>Download construction record <span>↓</span></button>
            </section>
          )}

          <section className="construction-boundary">
            <div><strong>Round 8 completed</strong><span>Active work is traceable through substantial completion with role-aware controls and progress-to-payment protection.</span></div>
            <div><strong>Round 9 remains</strong><span>Final inspection, corrections, warranty and permit closeout, final payment release, reviews, claims, and dispute protection.</span></div>
          </section>

          <div className="bottom-actions"><button className="secondary-button" onClick={() => chooseStep("payments")}>Back to payment gates</button><button className="primary-button" onClick={downloadConstructionRecord}>Download construction record</button></div>
        </>
      )}
    </div>
  );
}
