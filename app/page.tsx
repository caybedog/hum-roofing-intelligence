"use client";

import { useMemo, useState } from "react";

type View = "overview" | "intelligence" | "costs" | "matches" | "sharing" | "proposals";

type ShareKey = "scope" | "dimensions" | "location" | "budget" | "photos";

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
  },
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

  const estimate = useMemo(() => {
    const pitchFactor = pitch === "Steep" ? 1.28 : pitch === "Low" ? 1.06 : 1.15;
    const roofSquares = (sqft / stories / 100) * pitchFactor * 1.05;
    const materials = roofSquares * 247;
    const labor = roofSquares * 2.1 * 52 * (stories > 1 ? 1.12 : 1);
    const removal = roofSquares * 72;
    const details = 850 + 4 * 95 + 650;
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
            <span className="project-status"><i /> {requestsSent ? "Contractor review active" : "Preliminary scope ready"}</span>
          </div>
          <div className="top-actions">
            <button className="text-button">Save draft</button>
            <button className="primary-button" onClick={() => go(requestsSent ? "proposals" : "matches")}>{requestsSent ? "Review proposals" : "Find contractors"}</button>
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
                <div className="section-title"><div><span className="eyebrow">What happens next</span><h2>From questions to a qualified contractor</h2></div><span className="step-count">Step {stage} of 4</span></div>
                <div className="timeline">
                  {[
                    ["Project intake", "Complete", "Your core property and roof details are structured."],
                    ["Review intelligence", stage > 2 ? "Complete" : "Current", "Confirm the assumptions HUM used before anything is shared."],
                    ["Choose matches", stage > 3 ? "Complete" : "Next", "Compare qualified contractors using clear fit reasons."],
                    ["Compare proposals", stage > 4 ? "Complete" : "Next", "Normalize pricing, exclusions, warranties, and risk before deciding."],
                  ].map(([title, label, copy], index) => (
                    <button key={title} className={`timeline-item ${index + 1 === stage ? "current" : ""}`} onClick={() => { setStage(index + 1); if (index === 1) go("intelligence"); if (index === 2) go("matches"); if (index === 3) go(requestsSent ? "proposals" : "sharing"); }}>
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
                <div><span>4</span><strong>On-site verification</strong><small>Required before agreement</small></div>
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

              <section className="decision-note section-block"><div><span className="eyebrow light">HUM recommendation</span><h2>Do not accept either proposal yet.</h2></div><div><p>Both offers still contain terms that could change the final cost. Request the missing material specifications, permit responsibility, and written change-order rates before an on-site visit.</p><button onClick={() => setNotice("Clarification checklist prepared for both contractors.")}>Prepare clarification checklist <span>→</span></button></div></section>
              <div className="bottom-actions"><button className="secondary-button" onClick={() => go("sharing")}>Review shared packet</button><button className="primary-button" onClick={() => setNotice("On-site verification is the next planned development round.")}>Plan site visits</button></div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
