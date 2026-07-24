"use client";

import { useMemo, useState } from "react";
import ConstructionWorkspace from "./construction-workspace";

type View = "overview" | "intelligence" | "costs" | "matches" | "sharing" | "proposals" | "verification" | "agreement" | "launch" | "construction";

type ShareKey = "scope" | "dimensions" | "location" | "budget" | "photos";
type VerificationStep = "planning" | "tracking" | "findings" | "revised";
type AgreementStep = "scope" | "documents" | "terms" | "packet";
type LaunchStep = "resolve" | "approvals" | "setup" | "payments" | "kickoff";

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

const finalAgreementChanges = [
  {
    id: "shingle-product",
    item: "Roofing system",
    before: "30-year architectural shingles",
    after: "NorthStar Coastal 30 system with named starter, ridge, and underlayment",
    source: "Selection schedule A",
  },
  {
    id: "decking-unit",
    item: "Additional decking",
    before: "Additional sheets at market rate",
    after: "$135 per 7/16-inch OSB sheet, written homeowner approval required",
    source: "Scope §4.2",
  },
  {
    id: "ventilation",
    item: "Intake ventilation",
    before: "No intake work included",
    after: "Contractor verifies intake balance before ordering and prices any correction",
    source: "Scope §6.1",
  },
  {
    id: "workers-comp",
    item: "Worker coverage",
    before: "No evidence in packet",
    after: "Fictional certificate added with review date and expiration",
    source: "Evidence register",
  },
  {
    id: "bond-proof",
    item: "Bond evidence",
    before: "Unreadable attachment",
    after: "Legible fictional bond record attached for independent confirmation",
    source: "Evidence register",
  },
  {
    id: "start-window",
    item: "Start and delay terms",
    before: "Begins after deposit",
    after: "Start Aug 24–28; written notice required for any delay",
    source: "Schedule §2",
  },
  {
    id: "cleanup",
    item: "Protection and cleanup",
    before: "Leave broom clean",
    after: "Daily debris removal, landscape protection, magnetic sweep, final walkthrough",
    source: "Site plan §5",
  },
  {
    id: "change-orders",
    item: "Change orders",
    before: "Contractor may proceed when necessary",
    after: "Written scope, price, and schedule approval before changed work begins",
    source: "Agreement §9",
  },
];

const launchDocuments = [
  {
    id: "permit",
    title: "Permit plan",
    record: "Contractor files before mobilization",
    date: "Due Aug 14, 2026",
    note: "Issuance must be recorded before the start window.",
  },
  {
    id: "liability",
    title: "Liability certificate",
    record: "Fictional policy record",
    date: "Expires Dec 31, 2026",
    note: "Independently confirm the carrier and active dates in a real project.",
  },
  {
    id: "bond",
    title: "Bond record",
    record: "Fictional legible evidence",
    date: "Reviewed Aug 7, 2026",
    note: "The demo records evidence review, not real verification.",
  },
  {
    id: "workers",
    title: "Worker coverage",
    record: "Fictional certificate",
    date: "Expires Jan 31, 2027",
    note: "Coverage status must be rechecked if the project is delayed.",
  },
  {
    id: "notice",
    title: "Required notices",
    record: "Placeholder notice packet",
    date: "Review before approval",
    note: "Jurisdiction-specific forms still require qualified human review.",
  },
  {
    id: "license",
    title: "License checkpoint",
    record: "DEMO-LIC-001",
    date: "Recheck before start",
    note: "No licensing agency was contacted by this demonstration.",
  },
];

const preconstructionItems = [
  { id: "staging", label: "Driveway staging area cleared and delivery path confirmed." },
  { id: "vehicles", label: "Vehicles moved outside the material and debris zone." },
  { id: "pets", label: "Pet safety and gate-control plan acknowledged." },
  { id: "attic", label: "Attic access, interior protection, and dust expectations reviewed." },
  { id: "landscape", label: "Landscaping, siding, windows, and outdoor equipment protection mapped." },
  { id: "neighbors", label: "Noise window and neighbor-notice plan reviewed." },
  { id: "weather", label: "Weather delay, dry-in, and emergency contact process confirmed." },
  { id: "cleanup", label: "Daily cleanup, magnetic sweep, dumpster removal, and final walkthrough confirmed." },
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
  const [launchStep, setLaunchStep] = useState<LaunchStep>("resolve");
  const [agreementVersion, setAgreementVersion] = useState(1);
  const [agreementLocked, setAgreementLocked] = useState(false);
  const [approvalAcknowledgements, setApprovalAcknowledgements] = useState<string[]>([]);
  const [homeownerApproved, setHomeownerApproved] = useState(false);
  const [contractorApproved, setContractorApproved] = useState(false);
  const [demoSignatures, setDemoSignatures] = useState<string[]>([]);
  const [materialSelections, setMaterialSelections] = useState({
    system: "",
    color: "",
    underlayment: "",
    accessories: "",
  });
  const [documentChecks, setDocumentChecks] = useState<string[]>([]);
  const [logisticsConfirmed, setLogisticsConfirmed] = useState(false);
  const [paymentGateChecks, setPaymentGateChecks] = useState<string[]>([]);
  const [preconstructionChecks, setPreconstructionChecks] = useState<string[]>([]);
  const [launchLog, setLaunchLog] = useState([
    { time: "Aug 7 · 10:15 AM", type: "Agreement", note: "Round 6 readiness packet opened for final negotiation." },
    { time: "Aug 7 · 11:05 AM", type: "Change order", note: "Written price-and-schedule approval process added to the fictional draft." },
  ]);
  const [logDraft, setLogDraft] = useState("");
  const [launchActivated, setLaunchActivated] = useState(false);

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
  const allAgreementResolved = negotiationItems.every((item) => resolvedAgreementItems.includes(item.id));
  const approvalsComplete =
    homeownerApproved &&
    contractorApproved &&
    demoSignatures.includes("homeowner") &&
    demoSignatures.includes("contractor");
  const selectionsComplete = Object.values(materialSelections).every(Boolean);
  const documentsComplete = launchDocuments.every((document) => documentChecks.includes(document.id));
  const paymentGatesComplete = paymentSchedule.every((payment) => paymentGateChecks.includes(payment.milestone));
  const preconstructionComplete = preconstructionItems.every((item) => preconstructionChecks.includes(item.id));
  const launchRequirements = [
    { id: "agreement", label: "Negotiated agreement resolved and locked", ready: allAgreementResolved && agreementLocked },
    { id: "approvals", label: "Both demo approvals and acknowledgements recorded", ready: approvalsComplete },
    { id: "selections", label: "Materials and accessories selected", ready: selectionsComplete },
    { id: "documents", label: "Pre-start evidence checkpoints reviewed", ready: documentsComplete },
    { id: "logistics", label: "Start window, access, and contacts confirmed", ready: logisticsConfirmed },
    { id: "payments", label: "Milestone payment gates defined and reviewed", ready: paymentGatesComplete },
    { id: "site", label: "Pre-construction protection checklist complete", ready: preconstructionComplete },
  ];
  const launchScore = Math.round((launchRequirements.filter((requirement) => requirement.ready).length / launchRequirements.length) * 100);
  const kickoffReady = launchRequirements.every((requirement) => requirement.ready);

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

  const openLaunch = () => {
    if (!packetPrepared) {
      setNotice("Round 7 is using the preserved fictional Round 6 packet so you can inspect the launch workflow.");
      setTimeout(() => setNotice(""), 5000);
    }
    setStage(7);
    setLaunchStep(launchActivated ? "kickoff" : agreementLocked ? "approvals" : "resolve");
    go("launch");
  };

  const openConstruction = () => {
    if (!launchActivated) {
      setNotice("Round 8 is using HUM’s protected fictional kickoff record so you can inspect active construction without completing every earlier demo step.");
      setTimeout(() => setNotice(""), 5000);
    }
    setStage(8);
    go("construction");
  };

  const toggleAgreementItem = (id: string) => {
    if (agreementLocked) {
      setNotice("Agreement version 2 is locked. Unlock it before changing a clarified term.");
      setTimeout(() => setNotice(""), 4000);
      return;
    }
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

  const applyNegotiatedAgreement = () => {
    if (agreementLocked) return;
    setResolvedAgreementItems(negotiationItems.map((item) => item.id));
    setAgreementVersion(2);
    setHomeownerApproved(false);
    setContractorApproved(false);
    setDemoSignatures([]);
    setLaunchActivated(false);
    if (agreementVersion < 2) {
      setLaunchLog((items) => [
        ...items,
        { time: "Aug 7 · 11:32 AM", type: "Agreement", note: "Eight negotiated clarifications applied to fictional agreement version 2." },
      ]);
    }
    setNotice("Negotiated demo terms applied. Review the changes before locking version 2.");
    setTimeout(() => setNotice(""), 4500);
  };

  const lockAgreementVersion = () => {
    if (!allAgreementResolved) {
      setNotice("Resolve every carried-forward warning before locking the agreement version.");
      setTimeout(() => setNotice(""), 4000);
      return;
    }
    setAgreementLocked(true);
    setAgreementVersion(2);
    setLaunchLog((items) => items.some((item) => item.note.includes("Version 2 locked")) ? items : [
      ...items,
      { time: "Aug 7 · 11:40 AM", type: "Version", note: "Version 2 locked for matching homeowner and contractor review." },
    ]);
    setNotice("Agreement version 2 locked. Both parties now review the same fictional record.");
    setTimeout(() => setNotice(""), 4500);
  };

  const unlockAgreementVersion = () => {
    setAgreementLocked(false);
    setHomeownerApproved(false);
    setContractorApproved(false);
    setDemoSignatures([]);
    setLaunchActivated(false);
    setNotice("Version unlocked for revision. Prior demo approvals and acknowledgements were cleared.");
    setTimeout(() => setNotice(""), 4500);
  };

  const toggleApprovalAcknowledgement = (id: string) => {
    setApprovalAcknowledgements((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
    setHomeownerApproved(false);
    setDemoSignatures((items) => items.filter((item) => item !== "homeowner"));
    setLaunchActivated(false);
  };

  const simulateHomeownerApproval = () => {
    if (!agreementLocked || approvalAcknowledgements.length < 3) return;
    setHomeownerApproved(true);
    setNotice("Demo homeowner approval recorded for locked version 2. This is not a legal signature.");
    setTimeout(() => setNotice(""), 4500);
  };

  const simulateContractorApproval = () => {
    if (!agreementLocked) return;
    setContractorApproved(true);
    setNotice("Fictional contractor approval recorded for locked version 2.");
    setTimeout(() => setNotice(""), 4000);
  };

  const toggleDemoSignature = (party: "homeowner" | "contractor") => {
    const approved = party === "homeowner" ? homeownerApproved : contractorApproved;
    if (!approved) return;
    setDemoSignatures((items) => items.includes(party) ? items.filter((item) => item !== party) : [...items, party]);
    setLaunchActivated(false);
  };

  const toggleDocumentCheck = (id: string) => {
    setDocumentChecks((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
    setLaunchActivated(false);
  };

  const togglePaymentGate = (milestone: string) => {
    setPaymentGateChecks((items) => items.includes(milestone) ? items.filter((item) => item !== milestone) : [...items, milestone]);
    setLaunchActivated(false);
  };

  const togglePreconstructionItem = (id: string) => {
    setPreconstructionChecks((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
    setLaunchActivated(false);
  };

  const addLaunchLogEntry = () => {
    const note = logDraft.trim();
    if (!note) return;
    setLaunchLog((items) => [
      ...items,
      { time: "Aug 7 · 12:05 PM", type: "Project note", note },
    ]);
    setLogDraft("");
    setNotice("Demo project note added locally. Nothing was sent to a contractor.");
    setTimeout(() => setNotice(""), 4000);
  };

  const activateProjectLaunch = () => {
    if (!kickoffReady) {
      setNotice("Complete every launch gate before marking the fictional project kickoff ready.");
      setTimeout(() => setNotice(""), 4500);
      return;
    }
    setLaunchActivated(true);
    setStage(7);
    setNotice("Project kickoff marked ready in this demo. No real action was taken.");
    setTimeout(() => setNotice(""), 5000);
  };

  const downloadLaunchRecord = () => {
    const lines = [
      "HUM PROJECT-LAUNCH RECORD",
      "Fictional demonstration · Not a contract, signature, payment record, or construction authorization",
      "",
      `Contractor: ${agreementProposal.contractor}`,
      `Agreement version: ${agreementVersion}`,
      `Version locked: ${agreementLocked ? "Yes" : "No"}`,
      `Demo approvals complete: ${approvalsComplete ? "Yes" : "No"}`,
      `Launch readiness: ${launchScore}%`,
      `Kickoff status: ${launchActivated ? "Demo kickoff ready" : kickoffReady ? "Ready to mark" : "Incomplete"}`,
      "",
      "FINAL AGREEMENT CHANGES",
      ...finalAgreementChanges.map((change) => `${resolvedAgreementItems.includes(change.id) ? "[RESOLVED]" : "[OPEN]"} ${change.item}: ${change.before} -> ${change.after}`),
      "",
      "MATERIAL SELECTIONS",
      `System: ${materialSelections.system || "Open"}`,
      `Color: ${materialSelections.color || "Open"}`,
      `Underlayment: ${materialSelections.underlayment || "Open"}`,
      `Accessories: ${materialSelections.accessories || "Open"}`,
      "",
      "PRE-START CHECKPOINTS",
      ...launchDocuments.map((document) => `${documentChecks.includes(document.id) ? "[REVIEWED]" : "[OPEN]"} ${document.title}: ${document.record}`),
      "",
      "PAYMENT GATES",
      ...paymentSchedule.map((payment) => `${paymentGateChecks.includes(payment.milestone) ? "[DEFINED]" : "[OPEN]"} ${payment.milestone}: ${money(payment.amount)} | No funds collected`),
      "",
      "PRE-CONSTRUCTION CHECKLIST",
      ...preconstructionItems.map((item) => `${preconstructionChecks.includes(item.id) ? "[COMPLETE]" : "[OPEN]"} ${item.label}`),
      "",
      "Project kickoff ready—no real signature, payment, message, or construction action has occurred.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "HUM-project-launch-record.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice("Demo launch record downloaded. It does not authorize construction.");
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
          <button className={view === "launch" ? "active" : ""} onClick={openLaunch}>
            <span>08</span> Project launch
          </button>
          <button className={view === "construction" ? "active" : ""} onClick={openConstruction}>
            <span>09</span> Active construction
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
            <span className="project-status"><i /> {view === "construction" ? "Active construction workspace" : launchActivated ? "Project kickoff ready" : view === "launch" ? "Project launch review in progress" : packetPrepared ? "Agreement packet ready" : view === "agreement" ? "Agreement review in progress" : preferredContractor ? "Preferred contractor selected" : inspectionReady ? "Verified scope ready" : visitsScheduled ? "Site visits scheduled" : requestsSent ? "Contractor review active" : "Preliminary scope ready"}</span>
          </div>
          <div className="top-actions">
            <button className="text-button">Save draft</button>
            <button
              className="primary-button"
              onClick={() => view === "construction" ? openConstruction() : launchActivated ? openConstruction() : view === "launch" || packetPrepared ? openLaunch() : preferredContractor || view === "agreement" ? openAgreement() : inspectionReady || visitsScheduled ? openVerification() : go(requestsSent ? "proposals" : "matches")}
            >
              {view === "construction" ? "Review active project" : launchActivated ? "Open active construction" : view === "launch" || packetPrepared ? "Continue project launch" : preferredContractor || view === "agreement" ? "Continue agreement review" : inspectionReady ? "Review verified scope" : visitsScheduled ? "Track site visits" : requestsSent ? "Review proposals" : "Find contractors"}
            </button>
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
                <div className="section-title"><div><span className="eyebrow">What happens next</span><h2>From questions to protected construction</h2></div><span className="step-count">Step {stage} of 8</span></div>
                <div className="timeline">
                  {[
                    ["Project intake", "Complete", "Your core property and roof details are structured."],
                    ["Review intelligence", stage > 2 ? "Complete" : "Current", "Confirm the assumptions HUM used before anything is shared."],
                    ["Choose matches", stage > 3 ? "Complete" : "Next", "Compare qualified contractors using clear fit reasons."],
                    ["Compare proposals", stage > 4 ? "Complete" : "Next", "Normalize pricing, exclusions, warranties, and risk before deciding."],
                    ["Verify on site", inspectionReady ? "Complete" : stage === 5 ? "Current" : "Next", "Replace remote assumptions with documented field findings."],
                    ["Prepare agreement", packetPrepared ? "Complete" : stage === 6 ? "Current" : "Next", "Audit the final scope, evidence, payment terms, and protections."],
                    ["Launch project", launchActivated ? "Complete" : stage === 7 ? "Current" : "Next", "Lock one version, record approvals, and clear every pre-start gate."],
                    ["Track construction", stage === 8 ? "Current" : "Next", "Coordinate progress, changes, decisions, payments, and issues through substantial completion."],
                  ].map(([title, label, copy], index) => (
                    <button key={title} className={`timeline-item ${index + 1 === stage && !((index === 4 && inspectionReady) || (index === 5 && packetPrepared) || (index === 6 && launchActivated)) ? "current" : ""}`} onClick={() => { setStage(index + 1); if (index === 1) go("intelligence"); if (index === 2) go("matches"); if (index === 3) go(requestsSent ? "proposals" : "sharing"); if (index === 4) openVerification(); if (index === 5) openAgreement(); if (index === 6) openLaunch(); if (index === 7) openConstruction(); }}>
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

                  <div className="bottom-actions">
                    <button className="secondary-button" onClick={() => setAgreementStep("terms")}>Back to terms</button>
                    <div className="button-row">
                      {packetPrepared && <button className="secondary-button" onClick={downloadAgreementPacket}>Download packet</button>}
                      {packetPrepared && <button className="primary-button" onClick={openLaunch}>Continue to project launch</button>}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {view === "launch" && (
            <>
              <section className="page-heading split-heading launch-heading">
                <div>
                  <span className="eyebrow copper">Project launch</span>
                  <h1>Start with one record everyone understands.</h1>
                  <p>HUM carries every unresolved warning into a protected pre-construction workflow, then shows exactly what must be cleared before a fictional kickoff can be marked ready.</p>
                </div>
                <div className="launch-meter" aria-label={`${launchScore} percent project launch readiness`}>
                  <strong>{launchScore}%</strong>
                  <span>launch readiness</span>
                  <small>{launchRequirements.filter((requirement) => requirement.ready).length} of {launchRequirements.length} gates clear</small>
                </div>
              </section>

              <section className="launch-project-bar">
                <div className="proposal-id">
                  <span>{agreementProposal.initials}</span>
                  <div><h3>{agreementProposal.contractor}</h3><small>Fictional contractor · {money(agreementProposal.revisedTotal)} verified proposal</small></div>
                </div>
                <div><span>Agreement version</span><strong>Version {agreementVersion}</strong></div>
                <div><span>Version state</span><strong>{agreementLocked ? "Locked for review" : "Editable demo draft"}</strong></div>
                <div><span>Kickoff state</span><strong>{launchActivated ? "Demo ready" : kickoffReady ? "Ready to mark" : "Gates remain"}</strong></div>
                <div className="nonbinding-pill">No real action</div>
              </section>

              <nav className="launch-tabs" aria-label="Project launch workflow">
                {([
                  ["resolve", "1", "Resolve & lock"],
                  ["approvals", "2", "Approvals"],
                  ["setup", "3", "Selections & setup"],
                  ["payments", "4", "Payment gates"],
                  ["kickoff", "5", "Kickoff dashboard"],
                ] as [LaunchStep, string, string][]).map(([key, number, label]) => (
                  <button key={key} className={launchStep === key ? "active" : ""} onClick={() => setLaunchStep(key)}>
                    <span>{number}</span>{label}
                  </button>
                ))}
              </nav>

              {launchStep === "resolve" && (
                <>
                  <section className="launch-intro">
                    <div><span className="eyebrow">Negotiation record</span><h2>Nothing disappears between readiness and launch.</h2></div>
                    <p>Round 6 found eight items requiring clarification. Round 7 records the revised wording, its source, and whether both parties are looking at the same locked version.</p>
                  </section>

                  <section className="version-control">
                    <div>
                      <span className="eyebrow light">Agreement control</span>
                      <h2>{agreementLocked ? "Version 2 is locked." : agreementVersion === 2 ? "Version 2 is ready to lock." : "Version 1 still carries open warnings."}</h2>
                      <p>{agreementLocked ? "Any new edit must unlock the version and clear both demo approvals." : "Apply the fictional negotiated terms, inspect every change, then lock the record before approvals."}</p>
                    </div>
                    <div className="version-stats">
                      <span><small>Current version</small><strong>v{agreementVersion}</strong></span>
                      <span><small>Clarifications</small><strong>{resolvedAgreementItems.filter((id) => negotiationItems.some((item) => item.id === id)).length}/8</strong></span>
                      <span><small>Review state</small><strong>{agreementLocked ? "Locked" : "Open"}</strong></span>
                    </div>
                    <div className="version-actions">
                      {!agreementLocked && !allAgreementResolved && <button onClick={applyNegotiatedAgreement}>Apply negotiated demo version</button>}
                      {!agreementLocked && allAgreementResolved && <button onClick={lockAgreementVersion}>Lock version 2 for review</button>}
                      {agreementLocked && <button onClick={unlockAgreementVersion}>Unlock and clear approvals</button>}
                    </div>
                  </section>

                  <section className="agreement-diff section-block">
                    <div className="diff-row diff-head"><span>Term</span><span>Round 6 wording</span><span>Negotiated version</span><span>Record</span></div>
                    {finalAgreementChanges.map((change) => {
                      const resolved = resolvedAgreementItems.includes(change.id);
                      return (
                        <div className="diff-row" key={change.id}>
                          <strong>{change.item}</strong>
                          <span>{change.before}</span>
                          <span>{change.after}</span>
                          <div>
                            <b className={`audit-status ${resolved ? "resolved" : "critical"}`}>{resolved ? "Resolved in v2" : "Still open"}</b>
                            <small>{change.source}</small>
                          </div>
                        </div>
                      );
                    })}
                  </section>

                  <section className="version-boundary">
                    <strong>Version-lock rule</strong>
                    <span>A locked version makes the demo approval record consistent. Unlocking it automatically clears prior approvals and acknowledgements so no one appears to approve changed terms.</span>
                  </section>

                  <div className="bottom-actions"><button className="secondary-button" onClick={openAgreement}>Back to readiness packet</button><button className="primary-button" disabled={!agreementLocked} onClick={() => setLaunchStep("approvals")}>{agreementLocked ? "Review approvals" : "Lock version 2 to continue"}</button></div>
                </>
              )}

              {launchStep === "approvals" && (
                <>
                  <section className="launch-intro">
                    <div><span className="eyebrow">Matching approvals</span><h2>Both parties acknowledge the same locked version.</h2></div>
                    <p>These controls only demonstrate consent tracking. They do not create an electronic signature, legal acceptance, identity verification, or an enforceable agreement.</p>
                  </section>

                  {!agreementLocked && (
                    <section className="launch-warning">
                      <div><strong>Agreement version is not locked</strong><span>Return to the comparison and lock the fully resolved version before recording approvals.</span></div>
                      <button className="secondary-button" onClick={() => setLaunchStep("resolve")}>Resolve and lock</button>
                    </section>
                  )}

                  <section className="party-approval-grid section-block">
                    <article className="approval-card">
                      <div className="approval-card-head">
                        <div><span>DH</span><div><small>Homeowner</small><strong>Demo homeowner</strong></div></div>
                        <b className={`audit-status ${homeownerApproved ? "resolved" : "review"}`}>{homeownerApproved ? "Approved v2" : "Awaiting review"}</b>
                      </div>
                      <p>Before the demo approval can be recorded, the homeowner acknowledges each boundary.</p>
                      <div className="acknowledgement-list">
                        {[
                          ["scope", "I reviewed the negotiated scope and version-2 change summary."],
                          ["privacy", "I reviewed which fictional project details enter the launch record."],
                          ["demo", "I understand this is a demonstration and not a real contract or signature."],
                        ].map(([id, label]) => (
                          <label key={id}>
                            <input type="checkbox" checked={approvalAcknowledgements.includes(id)} onChange={() => toggleApprovalAcknowledgement(id)} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      <button className="primary-button" disabled={!agreementLocked || approvalAcknowledgements.length < 3 || homeownerApproved} onClick={simulateHomeownerApproval}>{homeownerApproved ? "Demo approval recorded" : "Record demo homeowner approval"}</button>
                    </article>

                    <article className="approval-card">
                      <div className="approval-card-head">
                        <div><span>{agreementProposal.initials}</span><div><small>Contractor</small><strong>{agreementProposal.contractor}</strong></div></div>
                        <b className={`audit-status ${contractorApproved ? "resolved" : "review"}`}>{contractorApproved ? "Approved v2" : "Awaiting review"}</b>
                      </div>
                      <p>The fictional contractor review shows the exact version, scope total, start window, payment triggers, and open-change process.</p>
                      <dl className="approval-summary">
                        <div><dt>Version</dt><dd>2 · locked</dd></div>
                        <div><dt>Project total</dt><dd>{money(agreementProposal.revisedTotal)}</dd></div>
                        <div><dt>Start window</dt><dd>Aug 24–28</dd></div>
                        <div><dt>Change orders</dt><dd>Written approval before work</dd></div>
                      </dl>
                      <button className="primary-button" disabled={!agreementLocked || contractorApproved} onClick={simulateContractorApproval}>{contractorApproved ? "Fictional approval recorded" : "Simulate contractor approval"}</button>
                    </article>
                  </section>

                  <section className="signature-record section-block">
                    <div>
                      <span className="eyebrow light">Acknowledgement record</span>
                      <h2>Visible status without pretending to sign.</h2>
                      <p>Each button records a fictional acknowledgement attached to version 2. Names, handwriting, identity documents, certificates, and cryptographic signatures are not collected.</p>
                    </div>
                    <div className="signature-parties">
                      {[
                        ["homeowner", "Demo homeowner", homeownerApproved],
                        ["contractor", agreementProposal.contractor, contractorApproved],
                      ].map(([party, name, approved]) => {
                        const acknowledged = demoSignatures.includes(party as string);
                        return (
                          <div key={party as string}>
                            <span><small>{party === "homeowner" ? "Homeowner" : "Contractor"}</small><strong>{name as string}</strong></span>
                            <button disabled={!approved} className={acknowledged ? "acknowledged" : ""} onClick={() => toggleDemoSignature(party as "homeowner" | "contractor")}>{acknowledged ? "Acknowledged ✓" : approved ? "Record acknowledgement" : "Approval required"}</button>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <div className="bottom-actions"><button className="secondary-button" onClick={() => setLaunchStep("resolve")}>Back to version control</button><button className="primary-button" disabled={!approvalsComplete} onClick={() => setLaunchStep("setup")}>{approvalsComplete ? "Choose materials and setup" : "Complete both acknowledgements"}</button></div>
                </>
              )}

              {launchStep === "setup" && (
                <>
                  <section className="launch-intro">
                    <div><span className="eyebrow">Selections and setup</span><h2>Turn agreement language into a buildable plan.</h2></div>
                    <p>Product selections, document dates, site access, and communication records stay tied to the locked version so later changes remain visible.</p>
                  </section>

                  <section className="selection-panel">
                    <div className="selection-heading">
                      <span className="eyebrow light">Material schedule</span>
                      <h2>Name the system before ordering.</h2>
                      <p>Every option below is fictional and exists only to demonstrate a structured selection record.</p>
                    </div>
                    <div className="selection-fields">
                      <label>Roofing system
                        <select value={materialSelections.system} onChange={(event) => { setMaterialSelections((items) => ({ ...items, system: event.target.value })); setLaunchActivated(false); }}>
                          <option value="">Select a system</option>
                          <option>NorthStar Coastal 30 · fictional</option>
                          <option>Redwood WeatherGuard · fictional</option>
                        </select>
                      </label>
                      <label>Color
                        <select value={materialSelections.color} onChange={(event) => { setMaterialSelections((items) => ({ ...items, color: event.target.value })); setLaunchActivated(false); }}>
                          <option value="">Select a color</option>
                          <option>Weathered charcoal</option>
                          <option>Coastal cedar</option>
                          <option>Fog gray</option>
                        </select>
                      </label>
                      <label>Underlayment
                        <select value={materialSelections.underlayment} onChange={(event) => { setMaterialSelections((items) => ({ ...items, underlayment: event.target.value })); setLaunchActivated(false); }}>
                          <option value="">Select underlayment</option>
                          <option>High-performance synthetic · fictional</option>
                          <option>Self-adhered weather barrier · fictional</option>
                        </select>
                      </label>
                      <label>Accessories
                        <select value={materialSelections.accessories} onChange={(event) => { setMaterialSelections((items) => ({ ...items, accessories: event.target.value })); setLaunchActivated(false); }}>
                          <option value="">Select accessories</option>
                          <option>Matched starter, ridge, vents, and flashing kit</option>
                          <option>Matched starter, ridge, and low-profile vent kit</option>
                        </select>
                      </label>
                    </div>
                  </section>

                  <section className="launch-document-section section-block">
                    <div className="section-title"><div><span className="eyebrow">Pre-start evidence</span><h2>Review dates, expirations, and ownership</h2></div><span className="step-count">{documentChecks.length}/{launchDocuments.length} reviewed</span></div>
                    <div className="launch-document-grid">
                      {launchDocuments.map((document) => {
                        const checked = documentChecks.includes(document.id);
                        return (
                          <article key={document.id}>
                            <div><span className={`audit-status ${checked ? "resolved" : "review"}`}>{checked ? "Reviewed in demo" : "Review needed"}</span><small>Fictional</small></div>
                            <h3>{document.title}</h3>
                            <strong>{document.record}</strong>
                            <b>{document.date}</b>
                            <p>{document.note}</p>
                            <button className={checked ? "checked-action" : ""} onClick={() => toggleDocumentCheck(document.id)}>{checked ? "Reopen checkpoint" : "Mark checkpoint reviewed"}</button>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  <section className="logistics-card section-block">
                    <div className="logistics-heading">
                      <span className="eyebrow light">Project logistics</span>
                      <h2>Know who arrives, when, and how the property works.</h2>
                      <p>No contact details are exposed. The demo uses role-based placeholders and keeps direct personal information private.</p>
                    </div>
                    <div className="logistics-grid">
                      <span><small>Start window</small><strong>Aug 24–28, 2026</strong><b>5-day confirmed range</b></span>
                      <span><small>Expected duration</small><strong>4–5 workdays</strong><b>Weather dependent</b></span>
                      <span><small>Contractor lead</small><strong>Fictional project manager</strong><b>HUM relay only</b></span>
                      <span><small>Homeowner contact</small><strong>Demo homeowner</strong><b>Direct details private</b></span>
                      <span><small>Primary access</small><strong>Driveway + side gate</strong><b>Daily security check</b></span>
                      <span><small>Interior access</small><strong>Attic hatch by notice</strong><b>24-hour request</b></span>
                    </div>
                    <label className="logistics-confirmation">
                      <input type="checkbox" checked={logisticsConfirmed} onChange={(event) => { setLogisticsConfirmed(event.target.checked); setLaunchActivated(false); }} />
                      <span>I reviewed the fictional start window, duration, access plan, contact roles, and homeowner responsibilities.</span>
                    </label>
                  </section>

                  <section className="communication-log section-block">
                    <div className="section-title"><div><span className="eyebrow">Communication and change-order log</span><h2>One chronological project record</h2></div><span className="step-count">Demo only · nothing sent</span></div>
                    <div className="log-layout">
                      <div className="log-entries">
                        {launchLog.map((entry, index) => (
                          <div key={`${entry.time}-${index}`}><span>{entry.time}</span><b>{entry.type}</b><p>{entry.note}</p></div>
                        ))}
                      </div>
                      <div className="log-composer">
                        <label htmlFor="launch-note">Add a local demo note</label>
                        <textarea id="launch-note" value={logDraft} onChange={(event) => setLogDraft(event.target.value)} placeholder="Example: Confirm material delivery path before start." rows={5} />
                        <button className="primary-button" disabled={!logDraft.trim()} onClick={addLaunchLogEntry}>Add to demo log</button>
                        <small>This does not contact a contractor or create a real change order.</small>
                      </div>
                    </div>
                  </section>

                  <div className="bottom-actions"><button className="secondary-button" onClick={() => setLaunchStep("approvals")}>Back to approvals</button><button className="primary-button" disabled={!selectionsComplete || !documentsComplete || !logisticsConfirmed} onClick={() => setLaunchStep("payments")}>{selectionsComplete && documentsComplete && logisticsConfirmed ? "Review payment gates" : "Complete setup checkpoints"}</button></div>
                </>
              )}

              {launchStep === "payments" && (
                <>
                  <section className="launch-intro">
                    <div><span className="eyebrow">Milestone protection</span><h2>Define every gate without moving money.</h2></div>
                    <p>Round 7 records what must be true before a payment could become eligible. It does not charge a card, hold funds, issue a receipt, recommend a payment schedule, or verify local payment rules.</p>
                  </section>

                  <section className="payment-gate-grid">
                    {paymentSchedule.map((payment, index) => {
                      const checked = paymentGateChecks.includes(payment.milestone);
                      return (
                        <article key={payment.milestone} className={checked ? "reviewed" : ""}>
                          <div><span>{String(index + 1).padStart(2, "0")}</span><b className={`audit-status ${checked ? "resolved" : "review"}`}>{checked ? "Gate reviewed" : "Review gate"}</b></div>
                          <small>Fictional milestone</small>
                          <h3>{payment.milestone}</h3>
                          <strong>{money(payment.amount)}</strong>
                          <p>{payment.trigger}</p>
                          <dl>
                            <div><dt>Funds</dt><dd>Not collected</dd></div>
                            <div><dt>Receipt</dt><dd>Not created</dd></div>
                          </dl>
                          <button onClick={() => togglePaymentGate(payment.milestone)}>{checked ? "Reopen gate" : "Confirm gate definition"}</button>
                        </article>
                      );
                    })}
                  </section>

                  <section className="receipt-register section-block">
                    <div className="section-title"><div><span className="eyebrow">Payment and receipt register</span><h2>An empty ledger is the correct demo state</h2></div><span className="step-count">$0 collected</span></div>
                    <div className="receipt-row receipt-head"><span>Milestone</span><span>Gate state</span><span>Payment record</span><span>Receipt record</span></div>
                    {paymentSchedule.map((payment) => (
                      <div className="receipt-row" key={payment.milestone}>
                        <strong>{payment.milestone}</strong>
                        <span>{paymentGateChecks.includes(payment.milestone) ? "Definition reviewed" : "Awaiting review"}</span>
                        <span>No funds collected</span>
                        <span>No receipt issued</span>
                      </div>
                    ))}
                  </section>

                  <section className="preconstruction-panel section-block">
                    <div className="preconstruction-heading">
                      <span className="eyebrow light">Property readiness</span>
                      <h2>Protect people, pets, and the home before mobilization.</h2>
                      <p>Each acknowledgement is a fictional readiness record. A real project would assign owners, due dates, evidence, and re-checks.</p>
                      <strong>{preconstructionChecks.length}/{preconstructionItems.length} complete</strong>
                    </div>
                    <div className="preconstruction-list">
                      {preconstructionItems.map((item) => {
                        const checked = preconstructionChecks.includes(item.id);
                        return (
                          <button key={item.id} className={checked ? "complete" : ""} onClick={() => togglePreconstructionItem(item.id)}>
                            <span>{checked ? "✓" : "!"}</span>
                            <strong>{item.label}</strong>
                            <small>{checked ? "Acknowledged in demo" : "Needs review"}</small>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <div className="bottom-actions"><button className="secondary-button" onClick={() => setLaunchStep("setup")}>Back to project setup</button><button className="primary-button" disabled={!paymentGatesComplete || !preconstructionComplete} onClick={() => setLaunchStep("kickoff")}>{paymentGatesComplete && preconstructionComplete ? "Open kickoff dashboard" : "Clear payment and property gates"}</button></div>
                </>
              )}

              {launchStep === "kickoff" && (
                <>
                  <section className="kickoff-overview">
                    <div className="kickoff-score">
                      <span className="eyebrow light">Project launch readiness</span>
                      <strong>{launchScore}<small>%</small></strong>
                      <p>{kickoffReady ? "Every protected launch gate is clear in this fictional workflow." : `${launchRequirements.filter((requirement) => !requirement.ready).length} launch gate${launchRequirements.filter((requirement) => !requirement.ready).length === 1 ? "" : "s"} still need attention.`}</p>
                    </div>
                    <div className="launch-requirements">
                      <span className="eyebrow">Final launch gates</span>
                      <h2>{kickoffReady ? "Ready to mark the demo kickoff." : "Finish the remaining project protections."}</h2>
                      {launchRequirements.map((requirement) => (
                        <button key={requirement.id} className={requirement.ready ? "ready" : ""} onClick={() => {
                          if (requirement.id === "agreement") setLaunchStep("resolve");
                          if (requirement.id === "approvals") setLaunchStep("approvals");
                          if (["selections", "documents", "logistics"].includes(requirement.id)) setLaunchStep("setup");
                          if (["payments", "site"].includes(requirement.id)) setLaunchStep("payments");
                        }}>
                          <span>{requirement.ready ? "✓" : "!"}</span><strong>{requirement.label}</strong><small>{requirement.ready ? "Clear" : "Review"}</small>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="kickoff-facts section-block">
                    <article><span className="eyebrow">Locked agreement</span><strong>Version {agreementVersion}</strong><p>{agreementLocked ? "Both fictional approvals refer to this exact version." : "Agreement version still needs locking."}</p></article>
                    <article><span className="eyebrow">Selected system</span><strong>{materialSelections.color || "Selection open"}</strong><p>{materialSelections.system || "Choose the fictional roofing system."}</p></article>
                    <article><span className="eyebrow">Start plan</span><strong>Aug 24–28</strong><p>4–5 workdays · driveway staging · attic by notice</p></article>
                    <article><span className="eyebrow">Money state</span><strong>$0 collected</strong><p>Four milestone definitions reviewed; no receipts issued.</p></article>
                  </section>

                  {!launchActivated ? (
                    <section className="activate-launch section-block">
                      <div><span className="eyebrow light">Round 7 final checkpoint</span><h2>{kickoffReady ? "Mark the fictional project kickoff ready." : "The kickoff remains protected."}</h2><p>{kickoffReady ? "This updates only the local demonstration status. It does not sign, pay, message, schedule, order, permit, or authorize construction." : "HUM will not allow the demo kickoff state until every visible requirement is complete."}</p></div>
                      <button disabled={!kickoffReady} onClick={activateProjectLaunch}>{kickoffReady ? "Mark demo kickoff ready" : `${launchScore}% ready`} <span>→</span></button>
                    </section>
                  ) : (
                    <section className="kickoff-ready-banner section-block">
                      <div><span className="eyebrow light">Round 7 complete</span><h2>Project kickoff ready—no real signature, payment, or construction action has occurred.</h2><p>The locked version, approvals, selections, evidence, logistics, payment gates, and property protections remain visible in one launch record.</p></div>
                      <button onClick={downloadLaunchRecord}>Download launch record <span>↓</span></button>
                    </section>
                  )}

                  <section className="launch-boundary">
                    <div><strong>What HUM did</strong><span>Organized fictional decisions, checked launch dependencies, preserved changes, and created a reviewable project record.</span></div>
                    <div><strong>What HUM did not do</strong><span>Create a real signature, transfer funds, contact a contractor, file a permit, order materials, or authorize any construction activity.</span></div>
                  </section>

                  <div className="bottom-actions"><button className="secondary-button" onClick={() => setLaunchStep("payments")}>Back to payment gates</button><button className="primary-button" onClick={downloadLaunchRecord}>Download launch record</button></div>
                </>
              )}
            </>
          )}

          {view === "construction" && <ConstructionWorkspace />}
        </div>
      </main>
    </div>
  );
}
