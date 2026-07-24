"use client";

import { useMemo, useState } from "react";

type View = "overview" | "intelligence" | "costs" | "matches" | "sharing" | "proposals" | "verification" | "agreement";

type ShareKey = "scope" | "dimensions" | "location" | "budget" | "photos";
type VerificationStep = "planning" | "tracking" | "findings" | "revised";
type AgreementStep = "scope" | "documents" | "terms" | "packet";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const contractors = [
  {
    initials: "RR",
    name: "Redwood Roofworks",
    location: "Eureka, CA",
    fit: 94,
    note: "Strong fit for asphalt replacement and two-story access.",
    tags: ["License verified", "Insurance current"],
    response: "Usually responds within 1 day",
  },
  {
    initials: "NC",
    name: "North Coast Exteriors",
    location: "McKinleyville, CA",
    fit: 89,
    note: "Experienced with coastal weather and active leak projects.",
    tags: ["License verified", "Leak specialist"],
    response: "Usually responds within 2 days",
  },
  {
    initials: "HB",
    name: "Humboldt Building Co.",
    location: "Arcata, CA",
    fit: 82,
    note: "Good service-area fit; availability needs confirmation.",
    tags: ["License verified", "References on file"],
    response: "Availability not confirmed",
  },
];

const proposals = [
  {
    contractor: "Redwood Roofworks",
    initials: "RR",
    status: "Proposal received",
    total: 19840,
    base: 18440,
    allowances: 1400,
    timeline: "3–4 workdays",
    start: "2–3 weeks",
    warranty: "10-year workmanship",
    fit: 94,
    included: ["Tear-off and disposal", "Architectural shingles", "Synthetic underlayment", "Chimney flashing replacement"],
    exclusions: ["Decking beyond 4 sheets", "Interior ceiling repair"],
    flags: ["Decking allowance is capped", "Permit fee needs confirmation"],
    revisedTotal: 21680,
    revisedTimeline: "4–5 workdays",
    revisedStart: "3–4 weeks",
    scopeChanges: ["Second tear-off layer included", "7 decking sheets carried", "Permit fee included", "Chimney flashing scope confirmed"],
    openTerms: ["Unit price for decking beyond 7 sheets", "Final shingle color selection"],
  },
  {
    contractor: "North Coast Exteriors",
    initials: "NC",
    status: "Proposal received",
    total: 21150,
    base: 21150,
    allowances: 0,
    timeline: "4–5 workdays",
    start: "About 2 weeks",
    warranty: "12-year workmanship",
    fit: 89,
    included: ["Tear-off and disposal", "Architectural shingles", "Peel-and-stick valleys", "Chimney flashing replacement", "Up to 6 decking sheets"],
    exclusions: ["Interior ceiling repair"],
    flags: ["Material product line not named", "Change-order labor rate not stated"],
    revisedTotal: 22320,
    revisedTimeline: "4–5 workdays",
    revisedStart: "About 3 weeks",
    scopeChanges: ["Second tear-off layer included", "7 decking sheets carried", "Permit fee included", "Named shingle system added"],
    openTerms: ["Change-order labor rate", "Interior protection method"],
  },
];

const visitWindowOptions = [
  "Tuesday, Aug 4 · 9–11 AM",
  "Tuesday, Aug 4 · 1–3 PM",
  "Wednesday, Aug 5 · 9–11 AM",
  "Wednesday, Aug 5 · 1–3 PM",
];

const inspectionFacts = [
  {
    label: "Roof measurement",
    value: "13.6 squares",
    note: "Eave-to-ridge field measurement with waste excluded",
    status: "Field verified",
  },
  {
    label: "Pitch and form",
    value: "6:12 hip roof",
    note: "Moderate pitch with four primary planes",
    status: "Field verified",
  },
  {
    label: "Existing layers",
    value: "Two asphalt layers",
    note: "Second layer visible at rake edge and attic opening",
    status: "Field verified",
  },
  {
    label: "Decking condition",
    value: "7-sheet allowance",
    note: "Seven soft areas mapped; final quantity remains concealed until tear-off",
    status: "Still conditional",
  },
  {
    label: "Chimney and flashing",
    value: "Full flashing replacement",
    note: "Step and counter flashing are both included in the revised scope",
    status: "Field verified",
  },
  {
    label: "Ventilation",
    value: "4 box vents + intake review",
    note: "Existing exhaust counted; intake balance remains a design check",
    status: "Needs clarification",
  },
  {
    label: "Access and disposal",
    value: "Driveway staging confirmed",
    note: "Two-story rear slope requires controlled hand carry",
    status: "Field verified",
  },
  {
    label: "Permit responsibility",
    value: "Contractor obtains permit",
    note: "Published fee is carried in both revised proposals",
    status: "Field verified",
  },
];

const agreementScopeRows = [
  {
    id: "roof-area",
    item: "Roof quantity",
    verified: "13.6 measured squares",
    draft: "13.6 roofing squares",
    status: "Aligned",
    tone: "clear",
    note: "The draft uses the field measurement.",
  },
  {
    id: "tear-off",
    item: "Existing roof removal",
    verified: "Remove two asphalt layers",
    draft: "Two-layer tear-off and disposal",
    status: "Aligned",
    tone: "clear",
    note: "Removal and disposal both appear in the draft.",
  },
  {
    id: "shingle-product",
    item: "Shingle system",
    verified: "Architectural system; product selection open",
    draft: "30-year architectural shingles",
    status: "Vague",
    tone: "review",
    note: "Manufacturer, product line, color, and accessory system are not named.",
  },
  {
    id: "decking-unit",
    item: "Decking repairs",
    verified: "7 sheets carried; more remains conditional",
    draft: "7 sheets included; additional at market rate",
    status: "Missing",
    tone: "critical",
    note: "The unit price and approval method for additional sheets are missing.",
  },
  {
    id: "flashing",
    item: "Chimney flashing",
    verified: "Full step and counter-flashing replacement",
    draft: "Replace chimney flashing system",
    status: "Aligned",
    tone: "clear",
    note: "The draft matches the verified scope.",
  },
  {
    id: "ventilation",
    item: "Ventilation",
    verified: "4 box vents plus intake design check",
    draft: "Reuse 4 box vents; no intake work included",
    status: "Altered",
    tone: "critical",
    note: "The open intake-balance check was converted into an exclusion.",
  },
  {
    id: "cleanup",
    item: "Protection and cleanup",
    verified: "Disposal and property protection expected",
    draft: "Remove debris and leave broom clean",
    status: "Vague",
    tone: "review",
    note: "Landscape protection, daily cleanup, and magnetic nail sweep are not stated.",
  },
  {
    id: "warranty",
    item: "Workmanship warranty",
    verified: "10-year workmanship term",
    draft: "10-year contractor workmanship warranty",
    status: "Aligned",
    tone: "clear",
    note: "The duration matches; exclusions still need to be attached.",
  },
];

const contractorDocuments = [
  {
    id: "license",
    title: "Contractor license",
    evidence: "DEMO-LIC-001 · fictional record",
    status: "Demo record present",
    tone: "clear",
    note: "Name, classification, and status fields are populated for workflow testing only.",
  },
  {
    id: "liability",
    title: "General liability insurance",
    evidence: "Fictional certificate · through Dec 31, 2026",
    status: "Demo record present",
    tone: "clear",
    note: "Carrier, policy period, and certificate holder fields are visible; HUM has not contacted a carrier.",
  },
  {
    id: "bond-proof",
    title: "Bond evidence",
    evidence: "Carrier named · attachment unreadable",
    status: "Review",
    tone: "review",
    note: "Request a readable document and independently confirm current status.",
  },
  {
    id: "workers-comp",
    title: "Workers’ compensation",
    evidence: "No document in demo packet",
    status: "Missing",
    tone: "critical",
    note: "Request current evidence or a valid, project-appropriate explanation before agreement.",
  },
];

const negotiationItems = [
  { id: "shingle-product", label: "Name the shingle manufacturer, product line, accessories, and selected color." },
  { id: "decking-unit", label: "Insert a fixed unit price and approval process for decking beyond 7 sheets." },
  { id: "ventilation", label: "Resolve the intake-ventilation design check instead of silently excluding it." },
  { id: "workers-comp", label: "Provide current workers’ compensation evidence or an applicable explanation." },
  { id: "bond-proof", label: "Replace the unreadable bond attachment with legible evidence." },
  { id: "start-window", label: "Replace “after deposit” with a measurable start window and delay notice process." },
  { id: "cleanup", label: "Define property protection, daily cleanup, final nail sweep, and disposal." },
  { id: "change-orders", label: "Require written price and schedule approval before changed work begins." },
];

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [sqft, setSqft] = useState(2000);
  const [stories, setStories] = useState(2);
  const [pitch, setPitch] = useState("Moderate");
  const [stage, setStage] = useState(2);
  const [requested, setRequested] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [requestsSent, setRequestsSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [shareItems, setShareItems] = useState<Record<ShareKey, boolean>>({
    scope: true,
    dimensions: true,
    location: true,
    budget: false,
    photos: false,
  });
  const [message, setMessage] = useState("Please review the preliminary scope and note anything that needs on-site verification.");
  const [compare, setCompare] = useState<string[]>(proposals.map((proposal) => proposal.contractor));
  const [visitContractors, setVisitContractors] = useState<string[]>(proposals.map((proposal) => proposal.contractor));
  const [visitWindows, setVisitWindows] = useState<Record<string, string>>({
    "Redwood Roofworks": visitWindowOptions[0],
    "North Coast Exteriors": visitWindowOptions[3],
  });
  const [visitConsent, setVisitConsent] = useState(false);
  const [visitsScheduled, setVisitsScheduled] = useState(false);
  const [inspectionReady, setInspectionReady] = useState(false);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("planning");
  const [preferredContractor, setPreferredContractor] = useState("");
  const [clarifications, setClarifications] = useState<string[]>([]);
  const [agreementStep, setAgreementStep] = useState<AgreementStep>("scope");
  const [resolvedAgreementItems, setResolvedAgreementItems] = useState<string[]>([]);
  const [agreementConsent, setAgreementConsent] = useState(false);
  const [packetPrepared, setPacketPrepared] = useState(false);

  const estimate = useMemo(() => {
    const pitchFactor = pitch === "Steep" ? 1.28 : pitch === "Low" ? 1.06 : 1.15;
    const roofSquares = (sqft / stories / 100) * pitchFactor * 1.05;
    const materials = roofSquares * 380;
    const labor = roofSquares * 4.2 * 52 * (stories > 1 ? 1.12 : 1);
    const removal = roofSquares * 105;
    const details = 850 + 4 * 95 + 1450;
    const direct = materials + labor + removal + details;
    const overhead = direct * 0.15;
    const contingency = (direct + overhead) * 0.05;
    const cost = direct + overhead + contingency;
    const target = cost / 0.75;
    return {
      roofSquares,
      materials,
      labor,
      removal,
      details,
      overhead,
      contingency,
      cost,
      target,
      low: target * 0.9,
      high: target * 1.18,
    };
  }, [pitch, sqft, stories]);

  const verifiedEstimate = useMemo(() => {
    const roofSquares = 13.6;
    const materials = roofSquares * 380;
    const labor = roofSquares * 4.2 * 52 * 1.12;
    const removal = roofSquares * 180;
    const details = 850 + 4 * 95 + 1700 + 7 * 135;
    const direct = materials + labor + removal + details;
    const overhead = direct * 0.15;
    const contingency = (direct + overhead) * 0.03;
    const cost = direct + overhead + contingency;
    const target = cost / 0.75;
    return {
      roofSquares,
      materials,
      labor,
      removal,
      details,
      overhead,
      contingency,
      cost,
      target,
      low: target * 0.92,
      high: target * 1.08,
    };
  }, []);

  const agreementProposal = proposals.find((proposal) => proposal.contractor === preferredContractor) ?? proposals[0];

  const paymentSchedule = useMemo(() => {
    const total = agreementProposal.revisedTotal;
    const deposit = 1000;
    const materials = Math.round(total * 0.35);
    const dryIn = Math.round(total * 0.35);
    const completion = total - deposit - materials - dryIn;
    return [
      { milestone: "Scheduling deposit", amount: deposit, trigger: "After both parties approve the final written agreement" },
      { milestone: "Materials staged", amount: materials, trigger: "Named materials delivered to or documented for the project" },
      { milestone: "Tear-off and dry-in", amount: dryIn, trigger: "Decking record approved and roof made weather-resistant" },
      { milestone: "Final completion", amount: completion, trigger: "Final checklist, corrections, cleanup, and closeout documents complete" },
    ];
  }, [agreementProposal.revisedTotal]);

  const openAgreementItems = negotiationItems.filter((item) => !resolvedAgreementItems.includes(item.id));
  const openCriticalItems = openAgreementItems.filter((item) => ["decking-unit", "ventilation", "workers-comp"].includes(item.id));
  const openReviewItems = openAgreementItems.length - openCriticalItems.length;
  const readinessScore = Math.max(45, 100 - openCriticalItems.length * 10 - openReviewItems * 3 - (agreementConsent ? 0 : 5));

  const go = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const requestQuote = (name: string) => {
    setRequested((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name]);
    setNotice(requested.includes(name) ? `${name} removed from this request.` : `${name} selected. No project details have been shared yet.`);
    setTimeout(() => setNotice(""), 4000);
  };

  const sendRequests = () => {
    if (!consent || !requested.length) return;
    setRequestsSent(true);
    setStage(4);
    setNotice(`Demo requests sent to ${requested.length} selected contractor${requested.length === 1 ? "" : "s"}.`);
    go("proposals");
    setTimeout(() => setNotice(""), 4000);
  };

  const toggleShare = (key: ShareKey) => setShareItems((items) => ({ ...items, [key]: !items[key] }));

  const toggleCompare = (name: string) => setCompare((items) =>
    items.includes(name) ? items.filter((item) => item !== name) : items.length < 2 ? [...items, name] : [items[1], name]
  );

  const openVerification = () => {
    setVisitContractors(compare.length ? compare : proposals.map((proposal) => proposal.contractor));
    setVerificationStep(visitsScheduled ? (inspectionReady ? "findings" : "tracking") : "planning");
    go("verification");
  };

  const toggleVisitContractor = (name: string) => {
    setVisitContractors((items) => {
      if (items.includes(name)) return items.filter((item) => item !== name);
      if (items.length < 2) return [...items, name];
      setNotice("Choose no more than two contractors for on-site verification.");
      setTimeout(() => setNotice(""), 4000);
      return items;
    });
  };

  const scheduleVisits = () => {
    if (!visitConsent || !visitContractors.length) return;
    setVisitsScheduled(true);
    setStage(5);
    setVerificationStep("tracking");
    setNotice(`Demo visits requested for ${visitContractors.length} contractor${visitContractors.length === 1 ? "" : "s"}. Nothing was sent externally.`);
    setTimeout(() => setNotice(""), 4000);
  };

  const loadInspectionResults = () => {
    setInspectionReady(true);
    setVerificationStep("findings");
    setNotice("Completed demo inspection reports are ready for review.");
    setTimeout(() => setNotice(""), 4000);
  };

  const requestVerificationClarification = (name: string) => {
    setClarifications((items) => items.includes(name) ? items : [...items, name]);
    setNotice(`Clarification checklist prepared for ${name}. Nothing was sent externally.`);
    setTimeout(() => setNotice(""), 4000);
  };

  const openAgreement = () => {
    if (!preferredContractor) {
      setNotice("Round 6 demo is showing Redwood Roofworks as the provisional contractor. Choose a preferred contractor in Round 5 to change it.");
      setTimeout(() => setNotice(""), 5000);
    }
    setAgreementStep(packetPrepared ? "packet" : "scope");
    go("agreement");
  };

  const toggleAgreementItem = (id: string) => {
    setResolvedAgreementItems((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  };

  const prepareAgreementPacket = () => {
    if (!agreementConsent) {
      setNotice("Review and approve the demo agreement information before preparing the packet.");
      setTimeout(() => setNotice(""), 4000);
      return;
    }
    setPacketPrepared(true);
    setStage(6);
    setAgreementStep("packet");
    setNotice("Agreement-readiness packet prepared for human review. No contract was signed or sent.");
    setTimeout(() => setNotice(""), 5000);
  };

  const downloadAgreementPacket = () => {
    const lines = [
      "HUM AGREEMENT-READINESS PACKET",
      "Fictional demonstration · Not a contract or legal advice",
      "",
      `Preferred contractor: ${agreementProposal.contractor}`,
      `Verified proposal total: ${money(agreementProposal.revisedTotal)}`,
      `Readiness score: ${readinessScore}/100`,
      `Open critical items: ${openCriticalItems.length}`,
      `Open review items: ${openReviewItems}`,
      "",
      "SCOPE AUDIT",
      ...agreementScopeRows.map((row) => `${row.status.toUpperCase()} · ${row.item}: ${row.draft} | ${row.note}`),
      "",
      "CONTRACTOR EVIDENCE",
      ...contractorDocuments.map((document) => `${document.status.toUpperCase()} · ${document.title}: ${document.evidence} | ${document.note}`),
      "",
      "PAYMENT MILESTONES",
      ...paymentSchedule.map((payment) => `${payment.milestone}: ${money(payment.amount)} | ${payment.trigger}`),
      "",
      "NEGOTIATION CHECKLIST",
      ...negotiationItems.map((item) => `${resolvedAgreementItems.includes(item.id) ? "[CLARIFIED IN DEMO]" : "[OPEN]"} ${item.label}`),
      "",
      "PRIVATE INFORMATION REVIEW",
      "Included: fictional demo homeowner name and fictional demo service address.",
      "Excluded: personal phone, personal email, payment details, and unapproved interior photos.",
      "",
      "Agreement packet ready for human review—no binding contract has been signed.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "HUM-agreement-readiness-packet.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice("Demo readiness packet downloaded. It is not a contract.");
    setTimeout(() => setNotice(""), 4000);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="wordmark" onClick={() => go("overview")} aria-label="HUM home">
          <span className="logo-mark">H</span>
          <span>HUM</span>
        </button>

        <div className="project-switcher">
          <span className="eyebrow">Current project</span>
          <strong>Sample residence</strong>
          <span>Eureka, California</span>
        </div>

        <nav aria-label="Workspace navigation">
          <button className={view === "overview" ? "active" : ""} onClick={() => go("overview")}>
            <span>01</span> Project overview
          </button>
          <button className={view === "intelligence" ? "active" : ""} onClick={() => go("intelligence")}>
            <span>02</span> Roof intelligence
          </button>
          <button className={view === "costs" ? "active" : ""} onClick={() => go("costs")}>
            <span>03</span> Cost model
          </button>
          <button className={view === "matches" ? "active" : ""} onClick={() => go("matches")}>
            <span>04</span> Contractor matches
          </button>
          <button className={view === "sharing" || view === "proposals" ? "active" : ""} onClick={() => go(requestsSent ? "proposals" : "sharing")}>
            <span>05</span> Requests & proposals
          </button>
          <button className={view === "verification" ? "active" : ""} onClick={openVerification}>
            <span>06</span> On-site verification
          </button>
          <button className={view === "agreement" ? "active" : ""} onClick={openAgreement}>
            <span>07</span> Agreement readiness
          </button>
        </nav>

        <div className="sidebar-foot">
          <div className="security-note"><span>Private</span> Your project stays private until you approve sharing.</div>
          <button className="profile"><span>DH</span><span><strong>Demo homeowner</strong><small>Homeowner workspace</small></span></button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="mobile-brand">HUM</span>
            <span className="project-status"><i /> {packetPrepared ? "Agreement packet ready" : view === "agreement" ? "Agreement review in progress" : preferredContractor ? "Preferred contractor selected" : inspectionReady ? "Verified scope ready" : visitsScheduled ? "Site visits scheduled" : requestsSent ? "Contractor review active" : "Preliminary scope ready"}</span>
          </div>
          <div className="top-actions">
            <button className="text-button">Save draft</button>
            <button className="primary-button" onClick={() => packetPrepared || preferredContractor || view === "agreement" ? openAgreement() : inspectionReady || visitsScheduled ? openVerification() : go(requestsSent ? "proposals" : "matches")}>{packetPrepared ? "Review readiness packet" : preferredContractor || view === "agreement" ? "Continue agreement review" : inspectionReady ? "Review verified scope" : visitsScheduled ? "Track site visits" : requestsSent ? "Review proposals" : "Find contractors"}</button>
          </div>
        </header>

        {notice && <div className="notice" role="status">{notice}</div>}

        <div className="content">
          {view === "overview" && (
            <>
              <section className="page-heading split-heading">
                <div>
                  <span className="eyebrow copper">Project 001 · Replacement</span>
                  <h1>Your roofing project,<br />made understandable.</h1>
                  <p>HUM has translated your answers into a preliminary scope, planning range, and next-step checklist.</p>
                </div>
                <div className="confidence-ring" aria-label="82 percent project confidence">
                  <div><strong>82%</strong><span>confidence</span></div>
                </div>
              </section>

              <section className="estimate-card">
                <div className="estimate-main">
                  <span className="eyebrow">Preliminary planning range</span>
                  <div className="range">{money(estimate.low)} <span>to</span> {money(estimate.high)}</div>
                  <p>Most likely planning figure <strong>{money(estimate.target)}</strong></p>
                </div>
                <div className="estimate-meta">
                  <div><span>Estimated roof</span><strong>{estimate.roofSquares.toFixed(1)} squares</strong></div>
                  <div><span>Project type</span><strong>Full replacement</strong></div>
                  <div><span>Location</span><strong>Eureka area, 95501</strong></div>
                </div>
                <div className="disclaimer"><strong>Planning guidance, not a quote.</strong> Final measurements, materials, concealed damage, and code requirements must be verified on site.</div>
              </section>

              <section className="section-block">
                <div className="section-title"><div><span className="eyebrow">What happens next</span><h2>From questions to an agreement-ready packet</h2></div><span className="step-count">Step {stage} of 6</span></div>
                <div className="timeline">
                  {[
                    ["Project intake", "Complete", "Your core property and roof details are structured."],
                    ["Review intelligence", stage > 2 ? "Complete" : "Current", "Confirm the assumptions HUM used before anything is shared."],
                    ["Choose matches", stage > 3 ? "Complete" : "Next", "Compare qualified contractors using clear fit reasons."],
                    ["Compare proposals", stage > 4 ? "Complete" : "Next", "Normalize pricing, exclusions, warranties, and risk before deciding."],
                    ["Verify on site", inspectionReady ? "Complete" : stage === 5 ? "Current" : "Next", "Replace remote assumptions with documented field findings."],
                    ["Prepare agreement", packetPrepared ? "Complete" : stage === 6 ? "Current" : "Next", "Audit the final scope, evidence, payment terms, and protections."],
                  ].map(([title, label, copy], index) => (
                    <button key={title} className={`timeline-item ${index + 1 === stage && !((index === 4 && inspectionReady) || (index === 5 && packetPrepared)) ? "current" : ""}`} onClick={() => { setStage(index + 1); if (index === 1) go("intelligence"); if (index === 2) go("matches"); if (index === 3) go(requestsSent ? "proposals" : "sharing"); if (index === 4) openVerification(); if (index === 5) openAgreement(); }}>
                      <span className="timeline-number">{index + 1}</span>
                      <span><small>{label}</small><strong>{title}</strong><p>{copy}</p></span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="two-column section-block">
                <div className="scope-card">
                  <div className="section-title"><div><span className="eyebrow">Preliminary scope</span><h2>What HUM understood</h2></div><button className="link-button" onClick={() => go("intelligence")}>Review details</button></div>
                  <dl className="scope-list">
                    <div><dt>Primary concern</dt><dd>Active leak near chimney with upstairs ceiling staining</dd></div>
                    <div><dt>Existing roof</dt><dd>18-year-old asphalt shingles, one visible layer</dd></div>
                    <div><dt>Roof form</dt><dd>Moderate-pitch hip roof, two-story home</dd></div>
                    <div><dt>Known complexity</dt><dd>One chimney, four penetrations, moderate access</dd></div>
                  </dl>
                </div>
                <div className="action-card">
                  <span className="eyebrow light">Ready when you are</span>
                  <h2>See who fits this project.</h2>
                  <p>HUM explains why each contractor may fit before you choose who receives your project.</p>
                  <button onClick={() => go("matches")}>View 3 matches <span>→</span></button>
                </div>
              </section>
            </>
          )}

          {view === "intelligence" && (
            <>
              <section className="page-heading">
                <span className="eyebrow copper">Roof intelligence</span>
                <h1>Review what HUM understood.</h1>
                <p>These details drive the planning range. Change anything that looks wrong before moving forward.</p>
              </section>
              <section className="editor-grid">
                <div className="form-card">
                  <div className="section-title"><div><span className="eyebrow">Property</span><h2>Measured basics</h2></div><span className="verified-badge">Homeowner confirmed</span></div>
                  <div className="fields">
                    <label>Home square footage<input type="number" value={sqft} onChange={(e) => setSqft(Number(e.target.value) || 0)} /></label>
                    <label>Stories<select value={stories} onChange={(e) => setStories(Number(e.target.value))}><option value={1}>One story</option><option value={2}>Two stories</option><option value={3}>Three stories</option></select></label>
                    <label>Roof pitch<select value={pitch} onChange={(e) => setPitch(e.target.value)}><option>Low</option><option>Moderate</option><option>Steep</option></select></label>
                    <label>Roof shape<select defaultValue="Hip"><option>Gable</option><option>Hip</option><option>Complex</option></select></label>
                  </div>
                </div>
                <aside className="insight-panel">
                  <span className="eyebrow light">HUM observation</span>
                  <h3>An inspection should focus on the chimney transition.</h3>
                  <p>Staining near a chimney can come from flashing, surrounding shingles, or concealed water travel. HUM does not diagnose the cause remotely.</p>
                  <div className="inspection-list"><span>Verify step and counter flashing</span><span>Probe surrounding decking</span><span>Trace interior moisture path</span></div>
                </aside>
              </section>
              <section className="assumption-table section-block">
                <div className="section-title"><div><span className="eyebrow">Assumption check</span><h2>What still needs verification</h2></div></div>
                <div className="table-row table-head"><span>Item</span><span>Current assumption</span><span>Confidence</span><span>Verification</span></div>
                {[["Roof area", `${estimate.roofSquares.toFixed(1)} squares`, "Medium", "Field measurement"],["Decking repair", "4 sheet allowance", "Low", "After tear-off"],["Existing layers", "One layer", "Medium", "Edge inspection"],["Permit allowance", "$350", "Medium", "Local confirmation"]].map((row) => <div className="table-row" key={row[0]}>{row.map((cell, i) => <span key={cell} data-label={["Item","Assumption","Confidence","Verification"][i]}>{cell}</span>)}</div>)}
              </section>
              <div className="bottom-actions"><button className="secondary-button" onClick={() => go("overview")}>Back to overview</button><button className="primary-button" onClick={() => { setStage(3); go("costs"); }}>Confirm details and continue</button></div>
            </>
          )}

          {view === "costs" && (
            <>
              <section className="page-heading">
                <span className="eyebrow copper">Transparent cost model</span>
                <h1>See what the planning figure includes.</h1>
                <p>HUM separates job costs, operating overhead, risk allowance, and contractor profit so the economics are understandable.</p>
              </section>
              <section className="cost-layout">
                <div className="cost-stack">
                  {[['Materials', estimate.materials, 'Shingles, underlayment, accessories and waste'],['Labor', estimate.labor, 'Burdened crew labor using 2.1 hours per square'],['Removal & disposal', estimate.removal, 'One roofing layer and standard disposal'],['Roof details & mobilization', estimate.details, 'Chimney, penetrations and job setup'],['Operating overhead', estimate.overhead, '15% business overhead allowance'],['Contingency', estimate.contingency, '5% allowance for uncertainty']].map(([name,value,copy]) => <div className="cost-row" key={String(name)}><div><strong>{name}</strong><span>{copy}</span></div><strong>{money(Number(value))}</strong></div>)}
                </div>
                <aside className="price-summary">
                  <span className="eyebrow">Model summary</span>
                  <div><span>Estimated total cost</span><strong>{money(estimate.cost)}</strong></div>
                  <div><span>Target gross profit</span><strong>{money(estimate.target - estimate.cost)}</strong></div>
                  <div className="price-total"><span>Planning figure</span><strong>{money(estimate.target)}</strong></div>
                  <p>Uses a 25% target gross margin. This is not the same as adding a 25% markup.</p>
                </aside>
              </section>
              <section className="source-note section-block"><div><span className="eyebrow">Source status</span><h2>Demo assumptions still need local verification.</h2></div><p>Current material, labor, disposal, permit, and overhead inputs are prototype examples. HUM will only label a value “verified” after it is tied to a dated supplier quote, invoice, published fee, or contractor record.</p></section>
              <div className="bottom-actions"><button className="secondary-button" onClick={() => go("intelligence")}>Back to intelligence</button><button className="primary-button" onClick={() => go("matches")}>Continue to matches</button></div>
            </>
          )}

          {view === "matches" && (
            <>
              <section className="page-heading split-heading match-heading">
                <div><span className="eyebrow copper">Contractor matching preview</span><h1>Good fits, with reasons.</h1><p>These fictional profiles demonstrate how HUM will rank contractors without selling your contact information or creating a pay-to-win list.</p></div>
                <div className="privacy-card"><strong>You control sharing</strong><span>No contractor sees your name, address, photos, or contact details until you select them.</span></div>
              </section>
              <section className="match-list">
                {contractors.map((contractor, index) => (
                  <article className="contractor-card" key={contractor.name}>
                    <div className="rank">{String(index + 1).padStart(2,"0")}</div>
                    <div className="contractor-avatar">{contractor.initials}</div>
                    <div className="contractor-copy"><div className="contractor-name"><div><h2>{contractor.name}</h2><span>{contractor.location}</span></div><div className="fit-score"><strong>{contractor.fit}%</strong><span>project fit</span></div></div><p>{contractor.note}</p><div className="tag-row">{contractor.tags.map(tag => <span key={tag}>{tag}</span>)}</div><small>{contractor.response}</small></div>
                    <button className={requested.includes(contractor.name) ? "requested" : "match-button"} onClick={() => requestQuote(contractor.name)}>{requested.includes(contractor.name) ? "Selected ✓" : "Select contractor"}</button>
                  </article>
                ))}
              </section>
              <section className="matching-method"><span className="eyebrow">How ranking works</span><div><p><strong>35%</strong> Project-type experience</p><p><strong>25%</strong> Service area and availability</p><p><strong>25%</strong> License, insurance, and trust evidence</p><p><strong>15%</strong> Communication and response record</p></div></section>
              <div className="bottom-actions"><button className="secondary-button" onClick={() => go("costs")}>Back to cost model</button><button className="primary-button" disabled={!requested.length} onClick={() => go("sharing")}>Review sharing ({requested.length})</button></div>
            </>
          )}

          {view === "sharing" && (
            <>
              <section className="page-heading split-heading share-heading">
                <div><span className="eyebrow copper">Privacy checkpoint</span><h1>You choose what leaves HUM.</h1><p>Review the exact project packet before a contractor receives it. Identity and direct contact details stay private in this round.</p></div>
                <div className="packet-count"><strong>{requested.length}</strong><span>selected contractor{requested.length === 1 ? "" : "s"}</span></div>
              </section>

              {!requested.length ? (
                <section className="empty-state"><span className="eyebrow">Nothing selected</span><h2>Choose at least one contractor first.</h2><button className="primary-button" onClick={() => go("matches")}>Return to matches</button></section>
              ) : (
                <section className="share-layout">
                  <div className="share-card">
                    <div className="section-title"><div><span className="eyebrow">Project packet</span><h2>Included information</h2></div><span className="privacy-lock">Identity locked</span></div>
                    <div className="share-list">
                      {([
                        ["scope", "Project scope", "Concern, roof type, age, access, and desired work"],
                        ["dimensions", "Preliminary dimensions", `${sqft.toLocaleString()} sq ft home · ${estimate.roofSquares.toFixed(1)} estimated roof squares`],
                        ["location", "General service area", "Eureka area and ZIP 95501 · no street address"],
                        ["budget", "HUM planning range", `${money(estimate.low)}–${money(estimate.high)} · clearly labeled nonbinding`],
                        ["photos", "Project photos", "No photos uploaded in this demo"],
                      ] as [ShareKey, string, string][]).map(([key, title, copy]) => (
                        <button className={`share-row ${shareItems[key] ? "on" : ""}`} key={key} onClick={() => toggleShare(key)} aria-pressed={shareItems[key]}>
                          <span className="toggle"><i /></span><span><strong>{title}</strong><small>{copy}</small></span><b>{shareItems[key] ? "Included" : "Private"}</b>
                        </button>
                      ))}
                    </div>
                    <label className="message-field">Message to contractors<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={280} /><small>{message.length}/280 · Keep personal contact information out of this note.</small></label>
                  </div>
                  <aside className="recipient-card">
                    <span className="eyebrow light">Recipients</span>
                    <h2>Selected for review</h2>
                    <div>{contractors.filter((contractor) => requested.includes(contractor.name)).map((contractor) => <p key={contractor.name}><span>{contractor.initials}</span><span><strong>{contractor.name}</strong><small>{contractor.location}</small></span></p>)}</div>
                    <div className="locked-data"><strong>Still private</strong><span>Homeowner name</span><span>Street address</span><span>Phone and email</span><span>Unapproved photos</span></div>
                    <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I reviewed this packet and approve sharing only the items marked “Included.”</span></label>
                    <button className="send-button" disabled={!consent} onClick={sendRequests}>Send demo request{requested.length > 1 ? "s" : ""} <span>→</span></button>
                  </aside>
                </section>
              )}
              <div className="bottom-actions"><button className="secondary-button" onClick={() => go("matches")}>Back to matches</button><span className="microcopy">Demo only · nothing is transmitted to a real contractor</span></div>
            </>
          )}

          {view === "proposals" && (
            <>
              <section className="page-heading split-heading proposal-heading">
                <div><span className="eyebrow copper">Proposal workspace</span><h1>Compare the whole offer, not just the price.</h1><p>HUM standardizes scope, allowances, exclusions, timing, and warranty language so differences are visible before you choose.</p></div>
                <div className="request-state"><i /><span><strong>{requestsSent ? "2 proposals ready" : "Demo proposals"}</strong><small>1 contractor awaiting response</small></span></div>
              </section>

              <section className="request-progress">
                <div className="complete"><span>1</span><strong>Requests shared</strong><small>Project packet approved</small></div>
                <div className="complete"><span>2</span><strong>Proposals normalized</strong><small>2 offers received</small></div>
                <div className="current"><span>3</span><strong>Compare and clarify</strong><small>Current step</small></div>
                <div className={visitsScheduled ? "complete" : ""}><span>4</span><strong>On-site verification</strong><small>{visitsScheduled ? "Visits in progress" : "Required before agreement"}</small></div>
              </section>

              <section className="proposal-list section-block">
                <div className="section-title"><div><span className="eyebrow">Received proposals</span><h2>Two offers, normalized by HUM</h2></div><span className="step-count">Select up to 2 to compare</span></div>
                {proposals.map((proposal) => (
                  <article className={`proposal-card ${compare.includes(proposal.contractor) ? "selected" : ""}`} key={proposal.contractor}>
                    <button className="compare-check" onClick={() => toggleCompare(proposal.contractor)} aria-pressed={compare.includes(proposal.contractor)}>{compare.includes(proposal.contractor) ? "✓" : "+"}</button>
                    <div className="proposal-id"><span>{proposal.initials}</span><div><h3>{proposal.contractor}</h3><small>{proposal.status} · Fictional demo</small></div></div>
                    <div className="proposal-price"><span>Normalized total</span><strong>{money(proposal.total)}</strong><small>{proposal.allowances ? `${money(proposal.allowances)} in allowances` : "No separate allowances"}</small></div>
                    <div className="proposal-facts"><p><span>Duration</span><strong>{proposal.timeline}</strong></p><p><span>Estimated start</span><strong>{proposal.start}</strong></p><p><span>Workmanship</span><strong>{proposal.warranty}</strong></p></div>
                    <div className="proposal-flags"><span>{proposal.flags.length} clarification{proposal.flags.length === 1 ? "" : "s"}</span>{proposal.flags.map((flag) => <small key={flag}>{flag}</small>)}</div>
                  </article>
                ))}
              </section>

              {compare.length === 2 && (
                <section className="comparison section-block">
                  <div className="section-title"><div><span className="eyebrow">Apples-to-apples view</span><h2>What changes between these offers</h2></div></div>
                  <div className="comparison-grid comparison-head"><span>Comparison</span>{compare.map((name) => <strong key={name}>{name}</strong>)}</div>
                  {[
                    ["Total presented", ...compare.map((name) => money(proposals.find((p) => p.contractor === name)!.total))],
                    ["Decking included", ...compare.map((name) => name === "Redwood Roofworks" ? "4 sheets" : "6 sheets")],
                    ["Workmanship warranty", ...compare.map((name) => proposals.find((p) => p.contractor === name)!.warranty)],
                    ["Start window", ...compare.map((name) => proposals.find((p) => p.contractor === name)!.start)],
                    ["Known clarifications", ...compare.map((name) => `${proposals.find((p) => p.contractor === name)!.flags.length} open items`)],
                  ].map((row) => <div className="comparison-grid" key={row[0]}>{row.map((cell, index) => index === 0 ? <span key={cell}>{cell}</span> : <strong key={`${cell}-${index}`}>{cell}</strong>)}</div>)}
                </section>
              )}

              <section className="decision-note section-block"><div><span className="eyebrow light">HUM recommendation</span><h2>Do not accept either proposal yet.</h2></div><div><p>Both offers still contain terms that could change the final cost. Advance one or two contractors to a documented site visit, then compare their revised scopes against the same field record.</p><button onClick={() => { proposals.forEach((proposal) => requestVerificationClarification(proposal.contractor)); }}>Prepare clarification checklist <span>→</span></button></div></section>
              <div className="bottom-actions"><button className="secondary-button" onClick={() => go("sharing")}>Review shared packet</button><button className="primary-button" disabled={!compare.length} onClick={openVerification}>Plan site visits ({compare.length})</button></div>
            </>
          )}

          {view === "verification" && (
            <>
              <section className="page-heading split-heading verification-heading">
                <div>
                  <span className="eyebrow copper">On-site verification</span>
                  <h1>Turn assumptions into field-checked facts.</h1>
                  <p>Advance up to two contractors, control what is revealed for the visit, and see exactly how verified conditions change scope and price.</p>
                </div>
                <div className={`verification-state ${inspectionReady ? "ready" : ""}`}>
                  <span>{inspectionReady ? "Field record complete" : visitsScheduled ? "Visits scheduled" : "Planning visits"}</span>
                  <strong>{inspectionReady ? "8 findings" : `${visitContractors.length} contractor${visitContractors.length === 1 ? "" : "s"}`}</strong>
                  <small>{inspectionReady ? "6 verified · 2 unresolved" : "No real appointments are created"}</small>
                </div>
              </section>

              <nav className="verification-tabs" aria-label="Verification workflow">
                {([
                  ["planning", "1", "Plan visits"],
                  ["tracking", "2", "Track visits"],
                  ["findings", "3", "Review findings"],
                  ["revised", "4", "Revised proposals"],
                ] as [VerificationStep, string, string][]).map(([key, number, label]) => {
                  const disabled = key === "tracking" ? !visitsScheduled : (key === "findings" || key === "revised") ? !inspectionReady : false;
                  return (
                    <button key={key} className={verificationStep === key ? "active" : ""} disabled={disabled} onClick={() => setVerificationStep(key)}>
                      <span>{number}</span>{label}
                    </button>
                  );
                })}
              </nav>

              {verificationStep === "planning" && (
                <>
                  <section className="verification-planning">
                    <div className="visit-builder">
                      <div className="section-title">
                        <div><span className="eyebrow">Contractor advancement</span><h2>Choose who verifies the project</h2></div>
                        <span className="step-count">{visitContractors.length}/2 selected</span>
                      </div>
                      <div className="advance-list">
                        {proposals.map((proposal) => {
                          const selected = visitContractors.includes(proposal.contractor);
                          return (
                            <button key={proposal.contractor} className={`advance-card ${selected ? "selected" : ""}`} onClick={() => toggleVisitContractor(proposal.contractor)} aria-pressed={selected}>
                              <span className="contractor-avatar">{proposal.initials}</span>
                              <span><strong>{proposal.contractor}</strong><small>{money(proposal.total)} preliminary proposal · {proposal.fit}% project fit</small></span>
                              <b>{selected ? "Advanced ✓" : "Advance"}</b>
                            </button>
                          );
                        })}
                      </div>

                      <div className="visit-windows">
                        <span className="eyebrow">Available windows</span>
                        <h3>Choose one window per contractor</h3>
                        {proposals.filter((proposal) => visitContractors.includes(proposal.contractor)).map((proposal) => (
                          <label key={proposal.contractor}>
                            <span><strong>{proposal.contractor}</strong><small>Two-hour arrival window · fictional demo</small></span>
                            <select value={visitWindows[proposal.contractor]} onChange={(event) => setVisitWindows((items) => ({ ...items, [proposal.contractor]: event.target.value }))}>
                              {visitWindowOptions.map((window) => <option key={window}>{window}</option>)}
                            </select>
                          </label>
                        ))}
                        {!visitContractors.length && <p className="inline-empty">Advance at least one contractor to choose a visit window.</p>}
                      </div>
                    </div>

                    <aside className="visit-privacy">
                      <span className="eyebrow light">Privacy checkpoint</span>
                      <h2>Information needed for the visit</h2>
                      <p>Round 4 kept identity and the exact address private. A site visit requires a limited, explicit release.</p>
                      <div className="privacy-release">
                        <div><span>Shared for this visit</span><strong>Fictional demo service address</strong><small>Exact location, selected window, exterior access notes, and “Demo homeowner” display name</small></div>
                        <div className="locked"><span>Still private</span><strong>Direct contact information</strong><small>Personal phone, personal email, payment details, and unapproved interior photos</small></div>
                      </div>
                      <label className="visit-consent">
                        <input type="checkbox" checked={visitConsent} onChange={(event) => setVisitConsent(event.target.checked)} />
                        <span>I reviewed the visit packet and approve this limited release to the selected fictional contractors.</span>
                      </label>
                      <button className="schedule-button" disabled={!visitConsent || !visitContractors.length} onClick={scheduleVisits}>
                        Schedule demo visit{visitContractors.length === 1 ? "" : "s"} <span>→</span>
                      </button>
                      <small className="demo-note">Demo only · no address, identity, or appointment leaves HUM</small>
                    </aside>
                  </section>
                  <div className="bottom-actions"><button className="secondary-button" onClick={() => go("proposals")}>Back to proposals</button>{visitsScheduled && <button className="primary-button" onClick={() => setVerificationStep("tracking")}>Track scheduled visits</button>}</div>
                </>
              )}

              {verificationStep === "tracking" && (
                <>
                  <section className="tracking-intro">
                    <div><span className="eyebrow">Visit activity</span><h2>{inspectionReady ? "Both demo reports are ready." : "Track every visit from request to results."}</h2></div>
                    <p>{inspectionReady ? "Each contractor completed the same structured field checklist, allowing HUM to reconcile their findings." : "These appointments are simulated. Load the completed demo visits to continue through the full verification workflow."}</p>
                  </section>

                  <section className="visit-tracker-list">
                    {proposals.filter((proposal) => visitContractors.includes(proposal.contractor)).map((proposal) => {
                      const completedSteps = inspectionReady ? 4 : 2;
                      return (
                        <article className="visit-tracker" key={proposal.contractor}>
                          <div className="tracker-head">
                            <div className="proposal-id"><span>{proposal.initials}</span><div><h3>{proposal.contractor}</h3><small>{visitWindows[proposal.contractor]}</small></div></div>
                            <span className={`tracker-status ${inspectionReady ? "complete" : ""}`}>{inspectionReady ? "Results ready" : "Scheduled"}</span>
                          </div>
                          <div className="visit-status-line">
                            {["Requested", "Scheduled", "Completed", "Results ready"].map((label, index) => (
                              <div className={index < completedSteps ? "done" : index === completedSteps ? "current" : ""} key={label}>
                                <span>{index < completedSteps ? "✓" : index + 1}</span><strong>{label}</strong>
                              </div>
                            ))}
                          </div>
                          <div className="tracker-detail">
                            <span><small>Visit access</small><strong>Exterior + attic hatch</strong></span>
                            <span><small>Inspection form</small><strong>8 structured fields</strong></span>
                            <span><small>Photo evidence</small><strong>{inspectionReady ? "14 tagged photos" : "Awaiting visit"}</strong></span>
                          </div>
                        </article>
                      );
                    })}
                  </section>

                  {!inspectionReady ? (
                    <section className="simulation-card">
                      <div><span className="eyebrow light">Demo time jump</span><h2>Continue with completed site visits.</h2><p>This loads fictional inspection results for the sample project so you can test reconciliation and revised pricing.</p></div>
                      <button onClick={loadInspectionResults}>Load completed demo visits <span>→</span></button>
                    </section>
                  ) : (
                    <div className="bottom-actions"><button className="secondary-button" onClick={() => setVerificationStep("planning")}>Review visit details</button><button className="primary-button" onClick={() => setVerificationStep("findings")}>Review field findings</button></div>
                  )}
                </>
              )}

              {verificationStep === "findings" && (
                <>
                  <section className="field-record-heading">
                    <div><span className="eyebrow copper">Consolidated field record</span><h2>One verified scope, with evidence and limits.</h2><p>HUM reconciled both fictional contractor reports. A “field verified” label means the item was observable on site, not that concealed conditions are guaranteed.</p></div>
                    <div className="evidence-summary"><strong>2</strong><span>reports reconciled</span><strong>14</strong><span>tagged demo photos</span></div>
                  </section>

                  <section className="finding-grid">
                    {inspectionFacts.map((fact) => (
                      <article key={fact.label}>
                        <span className={`finding-status ${fact.status === "Field verified" ? "verified" : fact.status === "Still conditional" ? "conditional" : "clarify"}`}>{fact.status}</span>
                        <small>{fact.label}</small>
                        <strong>{fact.value}</strong>
                        <p>{fact.note}</p>
                      </article>
                    ))}
                  </section>

                  <section className="assumption-reconciliation section-block">
                    <div className="section-title"><div><span className="eyebrow">Assumption reconciliation</span><h2>What changed after the visit</h2></div><span className="step-count">Every price change stays traceable</span></div>
                    <div className="reconcile-row reconcile-head"><span>Scope item</span><span>Before visit</span><span>Field finding</span><span>Effect</span></div>
                    {[
                      ["Measured roof area", `${estimate.roofSquares.toFixed(1)} squares`, "13.6 squares", `+${(13.6 - estimate.roofSquares).toFixed(1)} squares measured`],
                      ["Existing layers", "One visible layer", "Two asphalt layers", "Second tear-off added"],
                      ["Decking repair", "4-sheet allowance", "7-sheet allowance", "3 more sheets carried"],
                      ["Chimney flashing", "Repair allowance", "Full replacement", "Scope made explicit"],
                      ["Permit", "$350 allowance", "Contractor obtains permit", "Fee included"],
                      ["Ventilation", "4 penetrations", "4 box vents + intake review", "One design check remains"],
                    ].map((row) => <div className="reconcile-row" key={row[0]}>{row.map((cell, index) => <span data-label={["Scope item", "Before", "Finding", "Effect"][index]} key={cell}>{cell}</span>)}</div>)}
                  </section>

                  <section className="unknowns-card section-block">
                    <div><span className="eyebrow light">Remaining uncertainty</span><h2>Three items still cannot be guaranteed.</h2><p>Round 5 reduces uncertainty; it does not pretend a visual inspection can reveal every concealed condition.</p></div>
                    <ul><li>Decking beyond the 7-sheet allowance after tear-off</li><li>Hidden sheathing directly beneath the chimney flashing</li><li>Weather-driven changes to material delivery and start date</li></ul>
                  </section>
                  <div className="bottom-actions"><button className="secondary-button" onClick={() => setVerificationStep("tracking")}>Back to visit tracking</button><button className="primary-button" onClick={() => setVerificationStep("revised")}>See recalculated scope and offers</button></div>
                </>
              )}

              {verificationStep === "revised" && (
                <>
                  <section className="verified-price-card">
                    <div><span className="eyebrow">Original HUM planning figure</span><strong>{money(estimate.target)}</strong><small>{money(estimate.low)}–{money(estimate.high)} preliminary range</small></div>
                    <span className="price-arrow">→</span>
                    <div className="verified-total"><span className="eyebrow light">Field-verified planning figure</span><strong>{money(verifiedEstimate.target)}</strong><small>{money(verifiedEstimate.low)}–{money(verifiedEstimate.high)} verified range</small></div>
                    <div className="price-change"><span>Explained change</span><strong>+{money(verifiedEstimate.target - estimate.target)}</strong><small>Driven by measured area, second-layer removal, decking, and finalized flashing scope</small></div>
                  </section>

                  <section className="verified-cost-model section-block">
                    <div className="section-title"><div><span className="eyebrow">Recalculated economics</span><h2>Where the verified figure comes from</h2></div><span className="step-count">25% target gross margin</span></div>
                    <div className="verified-cost-head"><span>Cost category</span><span>Preliminary</span><span>Verified</span><span>Why it changed</span></div>
                    {[
                      { name: "Materials", original: estimate.materials, verified: verifiedEstimate.materials, note: "13.6 measured squares" },
                      { name: "Labor", original: estimate.labor, verified: verifiedEstimate.labor, note: "Measured area and two-story handling" },
                      { name: "Removal & disposal", original: estimate.removal, verified: verifiedEstimate.removal, note: "Two confirmed roofing layers" },
                      { name: "Details & repairs", original: estimate.details, verified: verifiedEstimate.details, note: "7-sheet allowance and full flashing" },
                      { name: "Operating overhead", original: estimate.overhead, verified: verifiedEstimate.overhead, note: "15% of revised direct cost" },
                      { name: "Risk allowance", original: estimate.contingency, verified: verifiedEstimate.contingency, note: "Reduced to 3% after inspection" },
                    ].map((row) => (
                      <div className="verified-cost-row" key={row.name}>
                        <strong>{row.name}</strong><span>{money(row.original)}</span><span>{money(row.verified)}</span><small>{row.note}</small>
                      </div>
                    ))}
                  </section>

                  <section className="revised-offers section-block">
                    <div className="section-title"><div><span className="eyebrow">Revised proposals</span><h2>Same field record, standardized again</h2></div><span className="step-count">Final terms are still nonbinding</span></div>
                    <div className="revised-offer-list">
                      {proposals.filter((proposal) => visitContractors.includes(proposal.contractor)).map((proposal) => (
                        <article className={`revised-offer ${preferredContractor === proposal.contractor ? "preferred" : ""}`} key={proposal.contractor}>
                          <div className="revised-offer-head">
                            <div className="proposal-id"><span>{proposal.initials}</span><div><h3>{proposal.contractor}</h3><small>Revised after fictional site visit</small></div></div>
                            <div><span>Revised total</span><strong>{money(proposal.revisedTotal)}</strong><small>{proposal.revisedTotal > proposal.total ? `+${money(proposal.revisedTotal - proposal.total)} from preliminary` : "No increase"}</small></div>
                          </div>
                          <div className="revised-meta"><span><small>Duration</small><strong>{proposal.revisedTimeline}</strong></span><span><small>Start window</small><strong>{proposal.revisedStart}</strong></span><span><small>Workmanship</small><strong>{proposal.warranty}</strong></span></div>
                          <div className="offer-detail-columns">
                            <div><span className="eyebrow">Verified scope changes</span>{proposal.scopeChanges.map((change) => <p key={change}>✓ {change}</p>)}</div>
                            <div className="open-terms"><span className="eyebrow">Still needs agreement</span>{proposal.openTerms.map((term) => <p key={term}>• {term}</p>)}</div>
                          </div>
                          <div className="offer-actions">
                            <button className={preferredContractor === proposal.contractor ? "chosen" : "secondary-button"} onClick={() => { setPreferredContractor(proposal.contractor); setNotice(`${proposal.contractor} marked preferred. No agreement has been accepted.`); setTimeout(() => setNotice(""), 4000); }}>{preferredContractor === proposal.contractor ? "Preferred ✓" : "Mark preferred"}</button>
                            <button className="link-button" onClick={() => requestVerificationClarification(proposal.contractor)}>{clarifications.includes(proposal.contractor) ? "Clarification prepared ✓" : "Prepare clarification"}</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="verified-scope-banner section-block">
                    <div><span className="eyebrow light">Round 5 complete</span><h2>Verified scope ready.</h2><p>Field conditions, revised economics, and remaining unknowns are documented in one decision record.</p></div>
                    <div><strong>Final terms still require homeowner and contractor approval.</strong><span>No contract, signature, payment, or real message has been created.</span></div>
                  </section>
                  <div className="bottom-actions"><button className="secondary-button" onClick={() => setVerificationStep("findings")}>Back to findings</button><button className="primary-button" disabled={!preferredContractor} onClick={openAgreement}>{preferredContractor ? "Continue to agreement readiness" : "Choose a preferred contractor"}</button></div>
                </>
              )}
            </>
          )}

          {view === "agreement" && (
            <>
              <section className="page-heading split-heading agreement-heading">
                <div>
                  <span className="eyebrow copper">Agreement readiness</span>
                  <h1>Protect the project before anyone signs.</h1>
                  <p>HUM compares the fictional contractor draft against the verified scope, checks supporting evidence, and turns unresolved terms into a clear negotiation list.</p>
                </div>
                <div className="readiness-meter" aria-label={`${readinessScore} out of 100 agreement readiness`}>
                  <strong>{readinessScore}</strong>
                  <span>readiness score</span>
                  <small>{openCriticalItems.length} critical · {openReviewItems} review</small>
                </div>
              </section>

              <section className="agreement-contractor">
                <div className="proposal-id">
                  <span>{agreementProposal.initials}</span>
                  <div><h3>{agreementProposal.contractor}</h3><small>{preferredContractor ? "Preferred in Round 5" : "Provisional Round 6 demo selection"}</small></div>
                </div>
                <div><span>Verified proposal</span><strong>{money(agreementProposal.revisedTotal)}</strong></div>
                <div><span>Draft status</span><strong>Human review required</strong></div>
                <div className="nonbinding-pill">Fictional · nonbinding</div>
              </section>

              <nav className="agreement-tabs" aria-label="Agreement readiness workflow">
                {([
                  ["scope", "1", "Scope audit"],
                  ["documents", "2", "Evidence & privacy"],
                  ["terms", "3", "Terms & payments"],
                  ["packet", "4", "Readiness packet"],
                ] as [AgreementStep, string, string][]).map(([key, number, label]) => (
                  <button key={key} className={agreementStep === key ? "active" : ""} onClick={() => setAgreementStep(key)}>
                    <span>{number}</span>{label}
                  </button>
                ))}
              </nav>

              {agreementStep === "scope" && (
                <>
                  <section className="agreement-intro">
                    <div><span className="eyebrow">Final-scope comparison</span><h2>Eight terms checked against the field record.</h2></div>
                    <p>“Aligned” means the draft reflects the verified record. It does not guarantee workmanship, hidden conditions, enforceability, or legal compliance.</p>
                  </section>

                  <section className="scope-audit">
                    <div className="scope-audit-row scope-audit-head"><span>Scope item</span><span>Verified project</span><span>Contractor draft</span><span>HUM review</span></div>
                    {agreementScopeRows.map((row) => {
                      const resolved = resolvedAgreementItems.includes(row.id);
                      return (
                        <div className="scope-audit-row" key={row.id}>
                          <strong>{row.item}</strong>
                          <span>{row.verified}</span>
                          <span>{row.draft}</span>
                          <div className="audit-result">
                            <b className={`audit-status ${resolved ? "resolved" : row.tone}`}>{resolved ? "Clarified in demo" : row.status}</b>
                            <small>{row.note}</small>
                            {row.tone !== "clear" && <button onClick={() => toggleAgreementItem(row.id)}>{resolved ? "Reopen item" : "Simulate clarification"}</button>}
                          </div>
                        </div>
                      );
                    })}
                  </section>

                  <section className="risk-explainer section-block">
                    <div><span className="eyebrow light">Why HUM stopped the agreement</span><h2>Price agreement is not scope agreement.</h2><p>The revised total matches the selected proposal, but vague product language, an open decking price, and a ventilation exclusion can still change value or create conflict.</p></div>
                    <div className="risk-key">
                      <span><i className="key-critical" /><strong>Critical</strong><small>Could materially change scope, cost, or protection</small></span>
                      <span><i className="key-review" /><strong>Review</strong><small>Needs clearer wording or supporting detail</small></span>
                      <span><i className="key-clear" /><strong>Aligned</strong><small>Matches the current verified record</small></span>
                    </div>
                  </section>

                  <div className="bottom-actions"><button className="secondary-button" onClick={() => go("verification")}>Back to verified scope</button><button className="primary-button" onClick={() => setAgreementStep("documents")}>Review contractor evidence</button></div>
                </>
              )}

              {agreementStep === "documents" && (
                <>
                  <section className="agreement-intro">
                    <div><span className="eyebrow">Contractor evidence review</span><h2>Records are visible, dated, and never overstated.</h2></div>
                    <p>Every item below is fictional demo evidence. A real HUM record would show its source, date checked, and whether independent confirmation is still needed.</p>
                  </section>

                  <section className="document-grid">
                    {contractorDocuments.map((document) => {
                      const resolved = resolvedAgreementItems.includes(document.id);
                      return (
                        <article className="document-card" key={document.id}>
                          <div><span className={`audit-status ${resolved ? "resolved" : document.tone}`}>{resolved ? "Clarified in demo" : document.status}</span><small>Fictional evidence</small></div>
                          <h3>{document.title}</h3>
                          <strong>{document.evidence}</strong>
                          <p>{document.note}</p>
                          {document.tone !== "clear" && <button className="link-button" onClick={() => toggleAgreementItem(document.id)}>{resolved ? "Reopen evidence item" : "Simulate evidence received"}</button>}
                        </article>
                      );
                    })}
                  </section>

                  <section className="agreement-privacy section-block">
                    <div className="privacy-heading">
                      <span className="eyebrow light">Agreement privacy checkpoint</span>
                      <h2>Approve only what enters the review packet.</h2>
                      <p>The demo packet uses placeholders. HUM does not collect payment details, signatures, or government identification in this round.</p>
                    </div>
                    <div className="agreement-data-list">
                      <div><span><strong>Demo homeowner identity</strong><small>“Demo Homeowner” placeholder only</small></span><b>Included</b></div>
                      <div><span><strong>Demo service location</strong><small>Fictional project address placeholder</small></span><b>Included</b></div>
                      <div><span><strong>Direct phone and email</strong><small>HUM message relay remains the contact path</small></span><b className="private">Private</b></div>
                      <div><span><strong>Payment details and identification</strong><small>Not requested or stored in this demo</small></span><b className="private">Not collected</b></div>
                      <div><span><strong>Unapproved interior photos</strong><small>Excluded from the agreement packet</small></span><b className="private">Private</b></div>
                    </div>
                    <label className="agreement-consent">
                      <input type="checkbox" checked={agreementConsent} onChange={(event) => setAgreementConsent(event.target.checked)} />
                      <span>I reviewed the fictional agreement packet and approve only the two placeholder items marked “Included.”</span>
                    </label>
                  </section>

                  <div className="bottom-actions"><button className="secondary-button" onClick={() => setAgreementStep("scope")}>Back to scope audit</button><button className="primary-button" onClick={() => setAgreementStep("terms")}>Review terms and payments</button></div>
                </>
              )}

              {agreementStep === "terms" && (
                <>
                  <section className="agreement-intro">
                    <div><span className="eyebrow">Payment protection</span><h2>Payments follow visible project milestones.</h2></div>
                    <p>This prototype schedule is educational, not payment or legal advice. Deposit limits, notices, lien rules, and contract requirements must be checked for the project’s jurisdiction.</p>
                  </section>

                  <section className="payment-plan">
                    {paymentSchedule.map((payment, index) => (
                      <article key={payment.milestone}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div><small>Milestone</small><strong>{payment.milestone}</strong><p>{payment.trigger}</p></div>
                        <b>{money(payment.amount)}</b>
                      </article>
                    ))}
                    <div className="payment-total"><span>Fictional draft total</span><strong>{money(paymentSchedule.reduce((sum, payment) => sum + payment.amount, 0))}</strong><small>Confirm every trigger, amount, and local requirement before accepting a real schedule.</small></div>
                  </section>

                  <section className="change-order-card section-block">
                    <div><span className="eyebrow light">Written change-order process</span><h2>No surprise work or price.</h2><p>The demo process records the reason, exact scope change, price effect, and schedule effect before changed work is approved.</p></div>
                    <div className="change-order-flow">
                      {[
                        ["1", "Document condition", "Photos and field note identify why the change is needed."],
                        ["2", "Price the difference", "Labor, material, overhead, and allowance effects are itemized."],
                        ["3", "Show schedule effect", "Added days and any revised completion window are stated."],
                        ["4", "Written approval", "Both parties approve before changed work begins."],
                      ].map(([number, title, copy]) => <span key={title}><b>{number}</b><strong>{title}</strong><small>{copy}</small></span>)}
                    </div>
                    <button className={resolvedAgreementItems.includes("change-orders") ? "resolved-term" : "term-action"} onClick={() => toggleAgreementItem("change-orders")}>{resolvedAgreementItems.includes("change-orders") ? "Demo wording clarified ✓" : "Simulate adding this process"}</button>
                  </section>

                  <section className="responsibility-matrix section-block">
                    <div className="section-title"><div><span className="eyebrow">Schedule and responsibilities</span><h2>Who owns each part of the project</h2></div></div>
                    <div className="responsibility-row responsibility-head"><span>Term</span><span>Draft owner</span><span>Current wording</span><span>Review</span></div>
                    {[
                      ["Start window", "Contractor", "Begins after deposit and material availability", "Needs a measurable window and written delay notices"],
                      ["Completion", "Contractor", `Estimated ${agreementProposal.revisedTimeline}`, "Define completion and punch-list closeout"],
                      ["Weather delays", "Contractor", "Excusable delay", "Add notice timing and revised schedule"],
                      ["Permits", "Contractor", "Obtains and closes permit", "Aligned with verified scope"],
                      ["Property access", "Homeowner", "Driveway and attic hatch access", "Define dates, notice, and daily security"],
                      ["Protection and cleanup", "Contractor", "Broom clean", "Add landscaping, nail sweep, disposal, and damage process"],
                    ].map((row) => <div className="responsibility-row" key={row[0]}>{row.map((cell, index) => <span key={cell} data-label={["Term", "Owner", "Wording", "Review"][index]}>{cell}</span>)}</div>)}
                  </section>

                  <section className="negotiation-checklist section-block">
                    <div className="section-title"><div><span className="eyebrow">Negotiation checklist</span><h2>Turn every warning into a direct question</h2></div><span className="step-count">{openAgreementItems.length} open</span></div>
                    <div>
                      {negotiationItems.map((item) => {
                        const resolved = resolvedAgreementItems.includes(item.id);
                        return <button key={item.id} className={resolved ? "resolved" : ""} onClick={() => toggleAgreementItem(item.id)}><span>{resolved ? "✓" : "!"}</span><strong>{item.label}</strong><small>{resolved ? "Clarified in this demo" : "Needs human review"}</small></button>;
                      })}
                    </div>
                  </section>

                  <div className="bottom-actions"><button className="secondary-button" onClick={() => setAgreementStep("documents")}>Back to evidence</button><button className="primary-button" onClick={() => setAgreementStep("packet")}>Review readiness summary</button></div>
                </>
              )}

              {agreementStep === "packet" && (
                <>
                  <section className="packet-overview">
                    <div className="packet-score">
                      <span className="eyebrow light">Current readiness</span>
                      <strong>{readinessScore}<small>/100</small></strong>
                      <p>{openCriticalItems.length ? "Human review must address the critical items before anyone considers signing." : "No critical demo flags remain, but a qualified human should still review the full agreement."}</p>
                    </div>
                    <div className="packet-risk-summary">
                      <span className="eyebrow">Final risk summary</span>
                      <h2>{openCriticalItems.length} critical and {openReviewItems} review item{openReviewItems === 1 ? "" : "s"} remain.</h2>
                      <div><span><i className="key-critical" />Critical</span><strong>{openCriticalItems.length}</strong></div>
                      <div><span><i className="key-review" />Review</span><strong>{openReviewItems}</strong></div>
                      <div><span><i className="key-clear" />Clarified in demo</span><strong>{resolvedAgreementItems.length}</strong></div>
                    </div>
                  </section>

                  <section className="packet-contents section-block">
                    <div className="section-title"><div><span className="eyebrow">Readiness packet contents</span><h2>One record for homeowner and contractor review</h2></div><span className="step-count">Fictional demonstration</span></div>
                    <div>
                      <article><span>01</span><strong>Verified scope cross-check</strong><small>Eight draft terms compared with the Round 5 field record</small></article>
                      <article><span>02</span><strong>Contractor evidence register</strong><small>License, insurance, bond, and worker-coverage review states</small></article>
                      <article><span>03</span><strong>Payment and change-order plan</strong><small>Milestones, written approval flow, and schedule effects</small></article>
                      <article><span>04</span><strong>Open negotiation checklist</strong><small>{openAgreementItems.length} unresolved item{openAgreementItems.length === 1 ? "" : "s"} preserved for human review</small></article>
                      <article><span>05</span><strong>Privacy and sharing record</strong><small>{agreementConsent ? "Demo placeholders approved; private data excluded" : "Agreement information still awaiting approval"}</small></article>
                    </div>
                  </section>

                  {!agreementConsent && (
                    <section className="packet-consent-warning">
                      <div><strong>Privacy review incomplete</strong><span>Approve the fictional placeholder information before preparing the packet.</span></div>
                      <button className="secondary-button" onClick={() => setAgreementStep("documents")}>Review information</button>
                    </section>
                  )}

                  {!packetPrepared ? (
                    <section className="prepare-packet section-block">
                      <div><span className="eyebrow light">Round 6 final checkpoint</span><h2>Prepare the human-review packet.</h2><p>The packet preserves open warnings. It does not approve the contractor, decide legal sufficiency, accept terms, create a signature, or authorize payment.</p></div>
                      <button disabled={!agreementConsent} onClick={prepareAgreementPacket}>Prepare demo packet <span>→</span></button>
                    </section>
                  ) : (
                    <section className="agreement-ready-banner section-block">
                      <div><span className="eyebrow light">Round 6 complete</span><h2>Agreement packet ready for human review—no binding contract has been signed.</h2><p>Open risks and clarifications remain visible in the packet; HUM has not sent, signed, or accepted anything.</p></div>
                      <button onClick={downloadAgreementPacket}>Download readiness packet <span>↓</span></button>
                    </section>
                  )}

                  <section className="legal-boundary">
                    <strong>Human review boundary</strong>
                    <span>HUM organizes project information and flags inconsistencies. It does not provide legal advice, verify real records in this demo, or determine whether an agreement is enforceable.</span>
                  </section>

                  <div className="bottom-actions"><button className="secondary-button" onClick={() => setAgreementStep("terms")}>Back to terms</button>{packetPrepared && <button className="primary-button" onClick={downloadAgreementPacket}>Download packet</button>}</div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
