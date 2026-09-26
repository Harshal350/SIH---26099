import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import {
  classifyRecordType,
  compareRecords,
  extractDna,
  isMatchable,
  normalizeDescription,
  DECISION_POLICY,
  type Dna,
  type MatchClassification,
  type MatchEvidence,
  type MatchRecommendation,
  type RecordType,
} from "@/lib/matching";

export type RepoStatus = "CONNECTED" | "SYNCING" | "ERROR" | "DISCONNECTED";
export type MappingStatus = "MAPPED" | "PENDING" | "REVIEW" | "UNMAPPED";
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_CLARIFICATION";
export type DqSeverity = "ERROR" | "WARNING";
export type DqStatus = "OPEN" | "REMEDIATED" | "REVIEW";

/**
 * Provenance of a record, and the single most important honesty guarantee in
 * this prototype:
 *  - LIVE      returned by the linked source portal through /api/repos/sync
 *  - REFERENCE a real portal record captured earlier, with a real source id and
 *              source URL, but not re-fetched in this session
 *  - DEMO      synthetic, clearly-labelled demonstration data
 * The UI must never present DEMO (or a tender title) as a live material item.
 */
export type RecordOrigin = "LIVE" | "REFERENCE" | "DEMO";

export interface Repo {
  id: number;
  name: string;
  url: string;
  type: string;
  status: RepoStatus;
  records: number;
  lastSync: string;
  syncStatus: string;
  extractionStatus: string;
  health: string;
  category: string;
  sourceKey?: string;
}

export interface SourceMaterial {
  id: number;
  sourceOrganization: string;
  originalMaterialCode: string;
  originalDescription: string;
  originalUom: string;
  originalQuantity: string;
  normalizedDescription: string;
  category: string;
  lifecycle: string;
  mappingStatus: MappingStatus;
  nmcCode?: string;
  aiConfidence?: number | null;
  dataQuality: string;
  sourceDocument: string;
  sourceUrl?: string;
  sourceRecordId: string;

  /* ---- record-type classification (runs before material matching) ---- */
  /** MATERIAL | SERVICE | WORK | CONSULTANCY */
  recordType: RecordType;
  /** Material DNA extracted by the real extraction rules (never invented). */
  dna: Dna;

  /* ---- provenance ---- */
  /**
   * The tender/notice title this item was extracted FROM. Kept separate from
   * the item description so a tender title is never presented as a material.
   */
  sourceTenderTitle: string;
  /** ISO date the source record was retrieved. */
  retrievedAt: string;
  /**
   * A steward's corrected wording for this item, set when a data-quality issue
   * is remediated. The original source text is never overwritten; extraction
   * and matching read this instead when it is present, so a correction
   * actually survives instead of being re-derived away from the raw text.
   */
  stewardDescription?: string;
  /** LIVE only when the record really came from the linked portal. */
  origin: RecordOrigin;
  /** True when the description is an item-level BOQ description, not a notice title. */
  itemLevel: boolean;
}

export interface NmcCode {
  nationalCode: string;
  description: string;
  category: string;
  status: string;
}

export interface Mapping {
  id: number;
  cpse: string;
  sourceCode: string;
  rawDescription: string;
  normalizedDescription: string;
  nationalCode: string;
  nationalDesc: string;
  mappingStatus: MappingStatus;
  /**
   * The matcher's own confidence for the underlying candidate, when there was
   * one. A steward assignment with no matching evidence has no score, so this
   * is absent rather than invented.
   */
  confidence?: number;
  mappingSource: string;
  lastUpdated: string;
  createdBy: string;
  tenderDocName: string;
  tenderUrl: string;
  sourceCodeLabel: string;
  /** Per-attribute evidence behind the score, produced by the real engine. */
  evidence?: MatchEvidence;
  /** Set only by a human decision. */
  approvedBy?: string;
  approvedAt?: string;
  /** Source records folded into this national code. */
  lineage?: { cpse: string; sourceCode: string; sourceUrl?: string }[];
  /** Key of the MappingDecision this row was derived from. */
  decisionKey?: string;
}

export interface ReviewItem {
  id: number;
  cpseA: string;
  codeA: string;
  descA: string;
  cpseB: string;
  codeB: string;
  descB: string;
  suggestedNmc: string;
  suggestedDesc: string;
  confidence: number;
  reason: string;
  status: ReviewStatus;
  priority: "HIGH" | "MEDIUM" | "LOW";
  source: string;
  category: string;
  reviewedBy?: string;
  note?: string;
  /** Per-attribute evidence + conflicts from the real engine. */
  evidence?: MatchEvidence;
  classification?: MatchClassification;
  recommendation?: MatchRecommendation;
  /** ids into `materials`, so provenance can be resolved without guessing. */
  materialIdA?: number;
  materialIdB?: number;
  /** A conflict blocks automation; recorded explicitly for the reviewer. */
  autoMergeBlocked?: boolean;
}

export interface DqRecord {
  id: number;
  cpse: string;
  sourceCode: string;
  rawDescription: string;
  extractedDescription: string;
  dnaStatus: string;
  remediationRequired: boolean;
  issueType: string;
  severity: DqSeverity;
  status: DqStatus;
  lastUpdated: string;
  /** the record field the issue is about, e.g. "unit of measure" */
  field?: string;
  /** the concrete step that would resolve the issue */
  recommendedAction?: string;
}

export interface AuditEvent {
  id: number;
  createdAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: number | string;
  detail: string;
}

export interface ProcurementInsight {
  categoryDistribution: { category: string; records: number }[];
  cpseVolume: { cpse: string; records: number }[];
  /** % of source records that carry a human-approved NMC assignment. */
  nmcCoverage: number;
  unmappedPct: number;
  highValueCategories: string[];
  /** Open, actionable candidates that are not blocked by a conflict. */
  standardizationOpps: number;
  /** Candidates the engine classified as an actual duplicate. */
  duplicates: number;
  mappingCoverage: number;
  /** Records retrieved per month, from real audit events. */
  trend: { label: string; records: number }[];
}

/**
 * Metric populations are deliberately kept distinct so that no card implies a
 * subset relationship the data does not have.
 *
 *  sourceRecords        every ingested record
 *    ├─ matchable       MATERIAL records only (eligible for matching)
 *    └─ excluded        SERVICE / WORK / CONSULTANCY (never matched)
 *
 *  candidatesEvaluated  material pairs actually scored by the engine
 *  candidatesRejected   pairs scored below the candidate floor (never surfaced)
 *  recommended          scored >= policy, no conflict  -> a RECOMMENDATION only
 *  blocked              technical conflict               -> auto-merge blocked
 *  approved             a human accepted a recommendation
 *  mapped               approved AND assigned an NMC
 */
export interface MatchingStats {
  sourceRecords: number;
  matchableMaterials: number;
  excludedNonMaterial: number;
  candidatesEvaluated: number;
  candidatesRejected: number;
  recommended: number;
  blocked: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  mapped: number;
}

interface ProtoState {
  loading: boolean;
  repos: Repo[];
  materials: SourceMaterial[];
  nmcCodes: NmcCode[];
  mappings: Mapping[];
  reviewItems: ReviewItem[];
  dqRecords: DqRecord[];
  auditEvents: AuditEvent[];
  procurement: ProcurementInsight;
  matchingStats: MatchingStats;
  dashboard: any;

  lastMatchedAt: string | null;

  connectRepository: (r: Partial<Repo>) => void;
  syncRepository: (id: number) => Promise<void>;
  syncAllRepositories: () => Promise<void>;
  disconnectRepository: (id: number) => void;

  importMaterials: (records: SourceMaterial[], sourceDoc: string, note?: string) => void;

  runAiMatching: () => Promise<MatchingStats | null>;
  openReviewQueueFromMatch: () => void;

  /** Mappings only exist once a human approved them, so these act on the decision. */
  changeMapping: (mappingId: number, newNmc: string, reviewer: string) => void;
  removeMapping: (mappingId: number) => void;
  /** Revoke a human assignment and send the records back to unmapped. */
  revokeMapping: (mappingId: number, reviewer: string, note?: string) => void;

  updateReviewStatus: (id: number, status: ReviewStatus, reviewer: string, note?: string) => void;
  bulkUpdateReviewStatus: (ids: number[], reviewer: string) => void;

  mapMaterialToNmc: (materialId: number, nmc: string) => void;

  remediateDq: (id: number, patch: Partial<DqRecord>) => void;
  sendDqToAi: (ids: number[]) => void;
}

const ProtoContext = createContext<ProtoState | null>(null);

const today = new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

function capStr(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function seedRepos(): Repo[] {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("nmm_repos");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
  }

  const repos: Repo[] = [
    {
      id: 1,
      name: "Government e-Marketplace (GeM)",
      url: "https://bidplus.gem.gov.in/all-bids",
      type: "GeM",
      status: "CONNECTED",
      records: 0,
      lastSync: daysAgo(0),
      syncStatus: "READY",
      extractionStatus: "IDLE",
      health: "Healthy",
      category: "GENERAL",
      sourceKey: "gem",
    },
    {
      id: 2,
      name: "Coal India Limited (CIL) Tender Portal",
      url: "https://www.coalindia.in/tenders/",
      type: "CPSE_PORTAL",
      status: "CONNECTED",
      records: 0,
      lastSync: daysAgo(0),
      syncStatus: "READY",
      extractionStatus: "IDLE",
      health: "Healthy",
      category: "MINING",
      sourceKey: "coalindia",
    },
    {
      id: 3,
      name: "Bharat Heavy Electricals Limited (BHEL)",
      url: "https://www.bhel.com/tenders",
      type: "CPSE_PORTAL",
      status: "CONNECTED",
      records: 0,
      lastSync: daysAgo(0),
      syncStatus: "READY",
      extractionStatus: "IDLE",
      health: "Healthy",
      category: "EQUIPMENT",
      sourceKey: "bhel",
    },
    {
      id: 4,
      name: "Central Public Procurement Portal (CPPP)",
      url: "https://eprocure.gov.in/eprocure/app",
      type: "e-Procurement/CPPP",
      status: "CONNECTED",
      records: 0,
      lastSync: daysAgo(0),
      syncStatus: "READY",
      extractionStatus: "IDLE",
      health: "Healthy",
      category: "GENERAL",
      sourceKey: "cppp",
    },
    {
      id: 5,
      name: "Indian Oil Corporation Limited (IOCL)",
      url: "https://iocl.com/tenders",
      type: "CPSE_PORTAL",
      status: "CONNECTED",
      records: 0,
      lastSync: daysAgo(1),
      syncStatus: "READY",
      extractionStatus: "IDLE",
      health: "Healthy",
      category: "REFINING",
      sourceKey: "iocl",
    },
    {
      id: 6,
      name: "NTPC Limited e-Tendering",
      url: "https://ntpctender.ntpc.co.in/",
      type: "CPSE_PORTAL",
      status: "CONNECTED",
      records: 0,
      lastSync: daysAgo(1),
      syncStatus: "READY",
      extractionStatus: "IDLE",
      health: "Healthy",
      category: "POWER",
      sourceKey: "ntpc",
    },
    {
      id: 7,
      name: "Bharat Petroleum Corporation Limited (BPCL)",
      url: "https://www.bharatpetroleum.in/tender/tender.aspx",
      type: "CPSE_PORTAL",
      status: "CONNECTED",
      records: 0,
      lastSync: daysAgo(2),
      syncStatus: "READY",
      extractionStatus: "IDLE",
      health: "Healthy",
      category: "REFINING",
      sourceKey: "bpcl",
    },
    {
      id: 8,
      name: "Oil and Natural Gas Corporation (ONGC)",
      url: "https://tenders.ongc.co.in/",
      type: "CPSE_PORTAL",
      status: "CONNECTED",
      records: 0,
      lastSync: daysAgo(2),
      syncStatus: "READY",
      extractionStatus: "IDLE",
      health: "Healthy",
      category: "E&P",
      sourceKey: "ongc",
    },
  ];
  return repos;
}


function ils(a: number, b: number) {
  return a + Math.round(Math.random() * (b - a));
}

export const NATIONAL_CODE_PREFIX = "NMC";

export function getCategoryCode(category = "", desc = ""): string {
  const c = (category || "").toUpperCase();
  const d = (desc || "").toUpperCase();

  if (/BOLT|FASTENER|NUT|SCREW|STUD|WASHER/.test(d) || /FASTENER|BOLT/.test(c)) return "BOLT";
  if (/VALVE/.test(d) || /VALVE/.test(c)) return "VALVE";
  if (/CABLE|WIRE|CONDUCTOR/.test(d)) return "CABLE";
  if (/MCB|CIRCUIT BREAKER|SWITCHGEAR/.test(d)) return "MCB";
  if (/ELECTRICAL/.test(c)) return "ELEC";
  if (/PUMP/.test(d) || /PUMP/.test(c)) return "PUMP";
  if (/GASKET|O-RING|SEAL/.test(d) || /GASKET/.test(c)) return "GASKET";
  if (/BELT|CONVEYOR/.test(d)) return "BELT";
  if (/PIPE|TUBING|FLANGE|FITTING/.test(d) || /PIPE|PIPING/.test(c)) return "PIPE";
  if (/MOTOR/.test(d) || /MOTOR/.test(c)) return "MOTOR";
  if (/GAUGE|PRESSURE|TRANSMITTER|METER/.test(d) || /INSTRUMENT/.test(c)) return "GAUGE";
  if (/DRILL|BIT|CUTTER/.test(d) || /TOOL/.test(c)) return "DRILL";
  if (/ELECTRODE|WELDING/.test(d) || /WELD/.test(c)) return "WELD";
  if (/EXTINGUISHER|RESPIRATOR|SAFETY|MASK/.test(d) || /SAFETY/.test(c)) return "SAFETY";
  if (/GAS|CYLINDER|OXYGEN|ACETYLENE/.test(d)) return "GAS";
  if (/HYPOCHLORITE|HEXAMINE|ACID|SOLVENT/.test(d) || /CHEM/.test(c)) return "CHEM";
  if (/STEEL|VARNISH|SHEET|PLATE|IRON/.test(d) || /RAW_MATERIAL/.test(c)) return "STEEL";

  const clean = c.replace(/[^A-Z0-9]/g, "");
  return clean ? clean.slice(0, 6) : "GEN";
}

export const LEGACY_NMC_MAP: Record<string, string> = {
  "NMC-000001": "NMC-VALVE-000001",
  "NMC-000002": "NMC-CABLE-000002",
  "NMC-000003": "NMC-BOLT-000003",
  "NMC-000004": "NMC-PUMP-000004",
  "NMC-000005": "NMC-VALVE-000005",
  "NMC-000006": "NMC-GASKET-000006",
  "NMC-000007": "NMC-PIPE-000007",
  "NMC-000008": "NMC-MOTOR-000008",
  "NMC-000009": "NMC-GAUGE-000009",
  "NMC-000010": "NMC-DRILL-000010",
  "NMC-000011": "NMC-WELD-000011",
  "NMC-000012": "NMC-SAFETY-000012",
  "NMC-000013": "NMC-MCB-000013",
  "NMC-000014": "NMC-CHEM-000014",
  "NMC-000015": "NMC-GAS-000015",
  "NMC-000016": "NMC-CHEM-000016",
  "NMC-000017": "NMC-BELT-000017",
  "NMC-000018": "NMC-PUMP-000018",
  "NMC-000019": "NMC-SAFETY-000019",
  "NMC-000020": "NMC-STEEL-000020",
};

export function normalizeNmcCode(code?: string, desc = "", category = ""): string | undefined {
  if (!code) return code;
  if (LEGACY_NMC_MAP[code]) return LEGACY_NMC_MAP[code];
  if (/^[A-Z]{3}-[A-Z0-9]+-\d+$/i.test(code)) return code.toUpperCase();
  const oldMatch = code.match(/^NMC-(\d+)$/i);
  if (oldMatch) {
    const num = oldMatch[1].padStart(6, "0");
    const tag = getCategoryCode(category, desc);
    return `${NATIONAL_CODE_PREFIX}-${tag}-${num}`;
  }
  return code;
}

/**
 * Bumped whenever the shape of a cached record changes in a way that older
 * cached data cannot satisfy. On a version mismatch the derived caches are
 * dropped and rebuilt from the current pipeline, while the human decision log
 * (the only thing a person actually produced) is kept.
 */
const SCHEMA_VERSION = 3;

/**
 * Every record id that can legitimately exist right now: the seed set plus
 * anything previously ingested from a portal and still in the cache. A
 * decision is only dropped when its record is genuinely gone.
 */
function currentMaterialIds(): Set<number> {
  const ids = new Set(buildRecords([...DEMO_RECORDS, ...REFERENCE_RECORDS]).map((m) => m.id));
  try {
    const raw = localStorage.getItem("nmm_materials");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const m of parsed) if (typeof m?.id === "number") ids.add(m.id);
      }
    }
  } catch {}
  return ids;
}

export function migrateStorage(): void {
  if (typeof window === "undefined") return;

  const stored = localStorage.getItem("nmm_schema_version");
  const version = stored ? Number(stored) : 0;
  if (version === SCHEMA_VERSION) return;

  // Human decisions survive a schema bump, but any decision that points at a
  // record which no longer exists is dropped rather than silently retained.
  const validIds = currentMaterialIds();
  for (const key of ["nmm_review_decisions", "nmm_mapping_decisions"]) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) continue;
      const kept = list.filter((d: { key?: string; materialIds?: number[] }) => {
        const ids = d.materialIds ?? (d.key ? d.key.split("-").map(Number) : []);
        return ids.every((n: number) => validIds.has(n));
      });
      if (kept.length !== list.length) {
        localStorage.setItem(key, JSON.stringify(kept));
      }
    } catch {}
  }

  // nmm_materials is deliberately KEPT: it holds records that were genuinely
  // fetched from a portal, and enrichRecord() backfills every derived field, so
  // dropping it would destroy real ingested data. These caches, by contrast,
  // are re-derivable from the records plus the decision log, and a stale copy
  // would show values the current pipeline can no longer produce.
  for (const key of ["nmm_mappings", "nmm_reviews", "nmm_dq"]) {
    localStorage.removeItem(key);
  }

  localStorage.setItem("nmm_schema_version", String(SCHEMA_VERSION));
}

function seedNmcs(): NmcCode[] {
  const cats: [string, string, string][] = [
    ["NMC-VALVE-000001", "GATE VALVE DN80 PN16 CAST STEEL", "VALVE"],
    ["NMC-CABLE-000002", "CABLE 1.5 SQMM 3 CORE 1100V", "ELECTRICAL"],
    ["NMC-BOLT-000003", "HEX HEAD BOLT STAINLESS STEEL M16 X 50MM", "FASTENER"],
    ["NMC-PUMP-000004", "CENTRIFUGAL WATER PUMP 5 HP FLANGE MOUNTED", "PUMP"],
    ["NMC-VALVE-000005", "BALL VALVE 2 INCH SS304 PN16", "VALVE"],
    ["NMC-GASKET-000006", "NON ASBESTOS GASKET SHEET 3MM", "GASKET"],
    ["NMC-PIPE-000007", "CARBON STEEL PIPE SCH40 DN100", "PIPE"],
    ["NMC-MOTOR-000008", "INDUCTION MOTOR 3 PHASE 15 KW 415V", "MOTOR"],
    ["NMC-GAUGE-000009", "PRESSURE GAUGE 0-16 BAR BOTTOM ENTRY", "INSTRUMENT"],
    ["NMC-DRILL-000010", "SOLID CARBIDE DRILL BIT 10MM", "TOOLS"],
    ["NMC-WELD-000011", "WELDING ELECTRODE E7018 4MM", "WELDING"],
    ["NMC-SAFETY-000012", "FIRE EXTINGUISHER ABC 9KG", "SAFETY"],
    ["NMC-MCB-000013", "MINIATURE CIRCUIT BREAKER (MCB) 16A SINGLE POLE IS/IEC 60898", "ELECTRICAL"],
    ["NMC-CHEM-000014", "SODIUM HYPOCHLORITE SOLUTION CONFORMING TO IS 11673", "CHEMICALS"],
    ["NMC-GAS-000015", "INDUSTRIAL GAS CYLINDER OXYGEN / DISSOLVED ACETYLENE", "CHEMICALS"],
    ["NMC-CHEM-000016", "HEXAMINE TECHNICAL GRADE CHEMICAL", "CHEMICALS"],
    ["NMC-BELT-000017", "VULCANIZED RUBBER CONVEYOR BELT OIL & HEAT RESISTANT", "GASKET"],
    ["NMC-PUMP-000018", "SUBMERSIBLE WATER PUMP SET 5 HP VERTICAL 415V", "PUMP"],
    ["NMC-SAFETY-000019", "INDUSTRIAL AIRLINE HALF MASK RESPIRATOR SAFETY", "SAFETY"],
    ["NMC-STEEL-000020", "MAGNETIC STEEL SHEET VARNISH ELECTRICAL GRADE", "RAW_MATERIAL"],
    ["NMC-VALVE-000021", "BALL VALVE STAINLESS STEEL SS304 DN25", "VALVE"],
    ["NMC-VALVE-000022", "BALL VALVE STAINLESS STEEL SS316 DN25", "VALVE"],
    ["NMC-PUMP-000023", "CENTRIFUGAL PUMP 10 HP", "PUMP"],
  ];
  return cats.map(([code, desc, category]) => ({
    nationalCode: code,
    description: desc,
    category,
    status: "APPROVED",
  }));
}

function guessCat(desc: string): string {
  const d = desc.toUpperCase();
  if (/VALVE/.test(d)) return "VALVE";
  if (/CABLE/.test(d)) return "ELECTRICAL";
  if (/BOLT/.test(d)) return "FASTENER";
  if (/PUMP/.test(d)) return "PUMP";
  if (/GASKET/.test(d)) return "GASKET";
  if (/PIPE/.test(d)) return "PIPE";
  if (/MOTOR/.test(d)) return "MOTOR";
  if (/GAUGE/.test(d)) return "INSTRUMENT";
  if (/DRILL/.test(d)) return "TOOLS";
  if (/ELECTRODE/.test(d)) return "WELDING";
  if (/EXTINGUISHER/.test(d)) return "SAFETY";
  return "GENERAL";
}

const nmcHints: Record<string, string> = {
  "HEX HEAD BOLT": "NMC-BOLT-000003",
  "GATE VALVE": "NMC-VALVE-000001",
  "CABLE": "NMC-CABLE-000002",
  "WATER PUMP": "NMC-PUMP-000004",
  "CENTRIFUGAL WATER PUMP": "NMC-PUMP-000004",
  "CENTRIFUGAL PUMP": "NMC-PUMP-000004",
  "GASKET": "NMC-GASKET-000006",
  "BALL VALVE": "NMC-VALVE-000005",
  "PIPE": "NMC-PIPE-000007",
  "MOTOR": "NMC-MOTOR-000008",
  "PRESSURE GAUGE": "NMC-GAUGE-000009",
  "DRILL": "NMC-DRILL-000010",
  "ELECTRODE": "NMC-WELD-000011",
  "MINIATURE CIRCUIT BREAKER": "NMC-MCB-000013",
  "MCB": "NMC-MCB-000013",
  "CIRCUIT BREAKER": "NMC-MCB-000013",
  "SODIUM HYPOCHLORITE": "NMC-CHEM-000014",
  "HYPOCHLORITE": "NMC-CHEM-000014",
  "GAS CYLINDER": "NMC-GAS-000015",
  "OXYGEN": "NMC-GAS-000015",
  "HEXAMINE": "NMC-CHEM-000016",
  "CONVEYOR BELT": "NMC-BELT-000017",
  "RUBBER BELT": "NMC-BELT-000017",
  "SUBMERSIBLE": "NMC-PUMP-000018",
  "RESPIRATOR": "NMC-SAFETY-000019",
  "BREATHING": "NMC-SAFETY-000019",
  "STEEL SHEET VARNISH": "NMC-STEEL-000020",
  "VARNISH": "NMC-STEEL-000020",
  // Grade-specific entries come first (pickNmc tries the longest fragment
  // first), so a stated SS304/SS316 grade or a 10 HP rating resolves to the
  // matching catalogue entry instead of the generic one.
  "SS304": "NMC-VALVE-000021",
  "SS 304": "NMC-VALVE-000021",
  "SS316": "NMC-VALVE-000022",
  "SS 316": "NMC-VALVE-000022",
  "10 HP": "NMC-PUMP-000023",
  "10HP": "NMC-PUMP-000023",
};

/**
 * The hint table maps a wording fragment to a candidate NMC. It is only a
 * starting point: a fragment like "BALL VALVE" matches several catalogue
 * entries, so the candidate is checked against the attributes actually
 * extracted from the record before it is offered. A suggestion is never
 * returned when the catalogue contradicts the extracted grade or size.
 */
function pickNmc(desc: string, dna?: Dna, nmcs: NmcCode[] = []): string | undefined {
  const upper = desc.toUpperCase();
  const keys = Object.keys(nmcHints).sort((a, b) => b.length - a.length);
  const candidates: string[] = [];
  for (const k of keys) {
    if (!upper.includes(k.toUpperCase())) continue;
    const code = nmcHints[k];
    if (!candidates.includes(code)) candidates.push(code);
  }
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1 || nmcs.length === 0) return candidates[0];

  const grade = dna?.grade?.toUpperCase();
  const size = (dna?.diameter || dna?.size || "").toUpperCase();
  const capacity = (dna?.capacity || "").toUpperCase();

  const compatible = (code: string) => {
    const entry = nmcs.find((n) => n.nationalCode === code);
    if (!entry) return true;
    const text = `${entry.nationalCode} ${entry.description}`.toUpperCase();
    // If the record states a grade, the catalogue entry must agree with it.
    if (grade && /SS\s?304|304/.test(grade) && !/304/.test(text)) return false;
    if (grade && /SS\s?316|316/.test(grade) && !/316/.test(text)) return false;
    // Same for a stated nominal size.
    if (size && /\d/.test(size)) {
      const dn = size.match(/DN\s?(\d+)/i) || size.match(/^(\d+)/);
      if (dn && !text.includes(dn[1])) return false;
    }
    // And for a stated rating (pump kW/HP, motor HP, ...).
    if (capacity && /\d/.test(capacity)) {
      const num = capacity.match(/(\d+(?:\.\d+)?)/);
      if (num && !text.includes(num[1])) return false;
    }
    return true;
  };

  return candidates.find(compatible) ?? undefined;
}

/**
 * A source record specification. Every derived field (normalized description,
 * record type, Material DNA, data quality) is computed by the real pipeline —
 * nothing here is a hand-typed "AI score".
 */
interface RecordSpec {
  id: number;
  org: string;
  code: string;
  /** The item-level description, exactly as it appears in the source. */
  item: string;
  /** The tender/notice this item was extracted from. */
  tenderTitle: string;
  uom: string;
  qty: string;
  category: string;
  doc: string;
  url?: string;
  recordId: string;
  origin: RecordOrigin;
  itemLevel: boolean;
  retrievedAt: string;
  nmcCode?: string;
}

function buildRecords(specs: RecordSpec[]): SourceMaterial[] {
  return specs.map((s) => {
    const dna = extractDna(s.item);
    return {
      id: s.id,
      sourceOrganization: s.org,
      originalMaterialCode: s.code,
      originalDescription: s.item,
      originalUom: s.uom,
      originalQuantity: s.qty,
      normalizedDescription: normalizeDescription(s.item),
      category: s.category,
      lifecycle: "PENDING",
      mappingStatus: "UNMAPPED",
      // A code exists only once a human has assigned it. Until then, unmapped.
      nmcCode: undefined,
      // No score until the real matcher has actually run on this record.
      aiConfidence: null,
      // Derived from what the extractor really recovered.
      dataQuality: dna.grade || dna.material ? "COMPLETE" : "MISSING_GRADE",
      sourceDocument: s.doc,
      sourceUrl: s.url,
      sourceRecordId: s.recordId,
      recordType: classifyRecordType(s.item),
      dna,
      sourceTenderTitle: s.tenderTitle,
      retrievedAt: s.retrievedAt,
      origin: s.origin,
      itemLevel: s.itemLevel,
    } satisfies SourceMaterial;
  });
}

const DEMO_RETRIEVED = "2026-09-26T00:00:00.000Z";
const REFERENCE_RETRIEVED = "2026-09-20T00:00:00.000Z";

/**
 * Demonstration dataset. It is internally consistent and every field is derived,
 * but it is explicitly DEMO: the source ids are demo ids and the URLs point at
 * the real public portal entry pages, not at invented notices.
 */
const DEMO_RECORDS: RecordSpec[] = [
  // ---- CASE 1: same item, different wording -> should be approved -------------
  {
    id: 101,
    org: "COAL INDIA LIMITED",
    code: "DEMO-CIL-VLV-001",
    item: "BALL VALVE, SS304, 25 MM",
    tenderTitle: "Supply of pipe fittings and valves for plant expansion",
    uom: "NOS",
    qty: "40",
    category: "VALVE",
    doc: "DEMO: CIL valve schedule item 1",
    url: "https://www.coalindia.in/tenders/",
    recordId: "DEMO-CIL-VLV-001",
    origin: "DEMO",
    itemLevel: true,
    retrievedAt: DEMO_RETRIEVED,
  },
  {
    id: 102,
    org: "BHARAT HEAVY ELECTRICALS LIMITED (BHEL)",
    code: "DEMO-BHEL-VLV-007",
    item: "STAINLESS STEEL BALL VALVE 25MM SS304",
    tenderTitle: "Procurement of valves for FSIP Jagdishpur",
    uom: "NOS",
    qty: "24",
    category: "VALVE",
    doc: "DEMO: BHEL valve schedule item 7",
    url: "https://www.bhel.com/tenders",
    recordId: "DEMO-BHEL-VLV-007",
    origin: "DEMO",
    itemLevel: true,
    retrievedAt: DEMO_RETRIEVED,
  },
  // ---- CASE 2: same power, different kind of pump -> must NOT auto-merge ------
  {
    id: 103,
    org: "NTPC LIMITED",
    code: "DEMO-NTPC-PMP-012",
    item: "INDUSTRIAL PUMP 10 HP",
    tenderTitle: "Auxiliary system package for a thermal station",
    uom: "NOS",
    qty: "6",
    category: "PUMP",
    doc: "DEMO: NTPC pump schedule item 12",
    url: "https://ntpc.ntpc.co.in/tender",
    recordId: "DEMO-NTPC-PMP-012",
    origin: "DEMO",
    itemLevel: true,
    retrievedAt: DEMO_RETRIEVED,
  },
  {
    id: 104,
    org: "INDIAN OIL CORPORATION LIMITED (IOCL)",
    code: "DEMO-IOCL-PMP-003",
    item: "CENTRIFUGAL PUMP 10 HP",
    tenderTitle: "Refinery utilities package",
    uom: "NOS",
    qty: "4",
    category: "PUMP",
    doc: "DEMO: IOCL pump schedule item 3",
    url: "https://ioc.gov.in/tenders",
    recordId: "DEMO-IOCL-PMP-003",
    origin: "DEMO",
    itemLevel: true,
    retrievedAt: DEMO_RETRIEVED,
  },
  // ---- CASE 3: the SS316 counterpart ---------------------------------------
  // 101/102 above are both SS304 and 105/106 below are both SS316, so each pair
  // is internally consistent. The conflict the engine must block appears when a
  // SS304 record is compared with an SS316 one — e.g. DEMO-CIL-VLV-001 against
  // DEMO-BPCL-VLV-002 — which is what the blocked-candidate demo relies on.
  {
    id: 105,
    org: "Bharat Petroleum Corporation Limited (BPCL)",
    code: "DEMO-BPCL-VLV-002",
    item: "BALL VALVE, SS316, 25 MM",
    tenderTitle: "Terminal revamp piping package",
    uom: "NOS",
    qty: "30",
    category: "VALVE",
    doc: "DEMO: BPCL valve schedule item 2",
    url: "https://tenders.bppl.co.in",
    recordId: "DEMO-BPCL-VLV-002",
    origin: "DEMO",
    itemLevel: true,
    retrievedAt: DEMO_RETRIEVED,
  },
  {
    id: 106,
    org: "OIL AND NATURAL GAS CORPORATION (ONGC)",
    code: "DEMO-ONGC-VLV-019",
    item: "STAINLESS STEEL BALL VALVE 25MM SS316",
    tenderTitle: "Pipeline isolation valves",
    uom: "NOS",
    qty: "18",
    category: "VALVE",
    doc: "DEMO: ONGC valve schedule item 19",
    url: "https://tenders.ongc.co.in",
    recordId: "DEMO-ONGC-VLV-019",
    origin: "DEMO",
    itemLevel: true,
    retrievedAt: DEMO_RETRIEVED,
  },
  // ---- Excluded by record-type classification: a service, not a material -----
  {
    id: 107,
    org: "CENTRAL PUBLIC PROCUREMENT / GeM",
    code: "DEMO-GEM-SVC-044",
    item: "Subscription to Cloud Infrastructure Services and Managed Services",
    tenderTitle: "GeM bid notice DEMO-GEM-SVC-044",
    uom: "EA",
    qty: "1",
    category: "GENERAL",
    doc: "DEMO: notice-level record, not a BOQ item",
    url: "https://bidplus.gem.gov.in/all-bids",
    recordId: "DEMO-GEM-SVC-044",
    origin: "DEMO",
    itemLevel: false,
    retrievedAt: DEMO_RETRIEVED,
  },
  {
    id: 108,
    org: "POWER GRID CORPORATION OF INDIA LIMITED",
    code: "DEMO-PGCIL-WRK-009",
    item: "Construction of transmission tower foundation and civil works",
    tenderTitle: "Transmission line strengthening scope",
    uom: "EA",
    qty: "1",
    category: "GENERAL",
    doc: "DEMO: notice-level work record, not a BOQ item",
    url: "https://pgcil.gov.in/tenders",
    recordId: "DEMO-PGCIL-WRK-009",
    origin: "DEMO",
    itemLevel: false,
    retrievedAt: DEMO_RETRIEVED,
  },
];

/** Real portal records captured earlier, with their real ids and source URLs. */
const REFERENCE_RECORDS: RecordSpec[] = [
  {
    id: 1,
    org: "COAL INDIA LIMITED",
    code: "GEM/2026/B/8004695",
    item: "Hiring of Consultants - Milestone/Deliverable Based - Subscription to Cloud Infrastructure Services, Managed Services and CSP Consulting to enable Digital Transformation of Coal India Limited and its Subsidiary Companies",
    tenderTitle: "Hiring of Consultants - Milestone/Deliverable Based - Subscription to Cloud Infrastructure Services",
    uom: "EA",
    qty: "1",
    category: "GENERAL",
    doc: "Coal India NIT Notice GEM/2026/B/8004695",
    url: "https://www.coalindia.in/tenders/",
    recordId: "GEM/2026/B/8004695",
    origin: "REFERENCE",
    itemLevel: false,
    retrievedAt: REFERENCE_RETRIEVED,
  },
  {
    id: 2,
    org: "BHARAT HEAVY ELECTRICALS LIMITED (BHEL)",
    code: "FSIP/EOI/STM/2023-24-001",
    item: "EoI for Development of Vendors for supply of Magnetic Steel Sheet Varnish to BHEL FSIP Jagdishpur, Amethi",
    tenderTitle: "EoI for Development of Vendors for supply of Magnetic Steel Sheet Varnish to BHEL FSIP Jagdishpur",
    uom: "EA",
    qty: "1",
    category: "RAW_MATERIAL",
    doc: "BHEL Tender Notice FSIP/EOI/STM/2023-24-001",
    url: "https://www.bhel.com/tenders",
    recordId: "FSIP/EOI/STM/2023-24-001",
    origin: "REFERENCE",
    itemLevel: false,
    retrievedAt: REFERENCE_RETRIEVED,
  },
  {
    id: 3,
    org: "INDIAN OIL CORPORATION LIMITED (IOCL)",
    code: "GEM/2026/B/7994627",
    item: "Sodium Hypochlorite Solution (V3) Conforming To Is 11673",
    tenderTitle: "Supply of chemicals for refinery operations",
    uom: "EA",
    qty: "36000",
    category: "CHEMICALS",
    doc: "GeM Bid Notice GEM/2026/B/7994627",
    url: "https://bidplus.gem.gov.in/showbidDocument/9844712",
    recordId: "GEM/2026/B/7994627",
    origin: "REFERENCE",
    itemLevel: false,
    retrievedAt: REFERENCE_RETRIEVED,
  },
  {
    id: 4,
    org: "Central Public Procurement / GeM",
    code: "GEM/2026/B/8027429",
    item: "Miniature Circuit Breakers (MCB) for AC Operation Marked To IS/IEC 60898 (Part 1)",
    tenderTitle: "Supply of miniature circuit breakers",
    uom: "EA",
    qty: "500",
    category: "ELECTRICAL",
    doc: "GeM Bid Notice GEM/2026/B/8027429",
    url: "https://bidplus.gem.gov.in/all-bids",
    recordId: "GEM/2026/B/8027429",
    origin: "REFERENCE",
    itemLevel: false,
    retrievedAt: REFERENCE_RETRIEVED,
  },
  {
    id: 5,
    org: "COAL INDIA LIMITED",
    code: "GEM/2026/B/7973222",
    item: "GAS DA 1, GAS OXYGEN 1, INDUSTRIAL GAS CYLINDERS",
    tenderTitle: "Supply of industrial gas cylinders",
    uom: "EA",
    qty: "28709",
    category: "CHEMICALS",
    doc: "GeM Bid Notice GEM/2026/B/7973222",
    url: "https://bidplus.gem.gov.in/all-bids",
    recordId: "GEM/2026/B/7973222",
    origin: "REFERENCE",
    itemLevel: false,
    retrievedAt: REFERENCE_RETRIEVED,
  },
  {
    id: 6,
    org: "OIL AND NATURAL GAS CORPORATION (ONGC)",
    code: "GEM/2026/B/7831709",
    item: "Hexamine (ONGC)",
    tenderTitle: "Supply of specialty chemicals",
    uom: "EA",
    qty: "8000",
    category: "CHEMICALS",
    doc: "GeM Bid Notice GEM/2026/B/7831709",
    url: "https://bidplus.gem.gov.in/all-bids",
    recordId: "GEM/2026/B/7831709",
    origin: "REFERENCE",
    itemLevel: false,
    retrievedAt: REFERENCE_RETRIEVED,
  },
];

/** The seed dataset as built records. Exposed so verification can exercise
 *  the real derivation functions without a browser. */
export function seedFixtureMaterials(): SourceMaterial[] {
  return buildRecords([...DEMO_RECORDS, ...REFERENCE_RECORDS]);
}

function seedMaterials(): SourceMaterial[] {
  const seed = buildRecords([...DEMO_RECORDS, ...REFERENCE_RECORDS]);
  if (typeof window === "undefined") return seed;

  migrateStorage();
  const saved = localStorage.getItem("nmm_materials");
  if (!saved) return seed;

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) return seed;

    // Persisted records are real ingested data, so they are kept and only
    // backfilled. Seed records that are not present yet are appended, which
    // is what makes a newly added demo case visible without discarding
    // anything a portal actually returned.
    const restored = parsed.map((m: SourceMaterial) => enrichRecord(m));
    const present = new Set(restored.map((m) => m.id));
    const missing = seed.filter((m) => !present.has(m.id));
    return [...restored, ...missing];
  } catch {
    return seed;
  }
}

/**
 * Backfills derived fields on any record that predates them (older localStorage,
 * or a live payload that has not been through the extractor yet).
 */
export function enrichRecord(m: SourceMaterial): SourceMaterial {
  const dna = m.dna ?? extractDna(m.originalDescription);
  return {
    ...m,
    normalizedDescription: m.normalizedDescription || normalizeDescription(m.originalDescription),
    recordType: m.recordType ?? classifyRecordType(m.originalDescription),
    dna,
    sourceTenderTitle: m.sourceTenderTitle || m.sourceDocument || "",
    retrievedAt: m.retrievedAt || "",
    origin: m.origin ?? "REFERENCE",
    itemLevel: m.itemLevel ?? false,
    dataQuality: m.dataQuality || (dna.grade || dna.material ? "COMPLETE" : "MISSING_GRADE"),
    nmcCode: normalizeNmcCode(m.nmcCode, m.normalizedDescription || m.originalDescription, m.category),
  };
}

const nmcCodesById: Record<string, string> = {
  "NMC-VALVE-000001": "GATE VALVE DN80 PN16 CAST STEEL",
  "NMC-CABLE-000002": "CABLE 1.5 SQMM 3 CORE 1100V",
  "NMC-BOLT-000003": "HEX HEAD BOLT STAINLESS STEEL M16 X 50MM",
  "NMC-PUMP-000004": "CENTRIFUGAL WATER PUMP 5 HP FLANGE MOUNTED",
  "NMC-VALVE-000005": "BALL VALVE 2 INCH SS304 PN16",
  "NMC-GASKET-000006": "NON ASBESTOS GASKET SHEET 3MM",
  "NMC-PIPE-000007": "CARBON STEEL PIPE SCH40 DN100",
  "NMC-MOTOR-000008": "INDUCTION MOTOR 3 PHASE 15 KW 415V",
  "NMC-GAUGE-000009": "PRESSURE GAUGE 0-16 BAR BOTTOM ENTRY",
  "NMC-DRILL-000010": "SOLID CARBIDE DRILL BIT 10MM",
  "NMC-WELD-000011": "WELDING ELECTRODE E7018 4MM",
  "NMC-SAFETY-000012": "FIRE EXTINGUISHER ABC 9KG",
  "NMC-MCB-000013": "MINIATURE CIRCUIT BREAKER (MCB) 16A SINGLE POLE IS/IEC 60898",
  "NMC-CHEM-000014": "SODIUM HYPOCHLORITE SOLUTION CONFORMING TO IS 11673",
  "NMC-GAS-000015": "INDUSTRIAL GAS CYLINDER OXYGEN / DISSOLVED ACETYLENE",
  "NMC-CHEM-000016": "HEXAMINE TECHNICAL GRADE CHEMICAL",
  "NMC-BELT-000017": "VULCANIZED RUBBER CONVEYOR BELT OIL & HEAT RESISTANT",
  "NMC-PUMP-000018": "SUBMERSIBLE WATER PUMP SET 5 HP VERTICAL 415V",
  "NMC-SAFETY-000019": "INDUSTRIAL AIRLINE HALF MASK RESPIRATOR SAFETY",
  "NMC-STEEL-000020": "MAGNETIC STEEL SHEET VARNISH ELECTRICAL GRADE",
};

/**
 * A human decision on a candidate pair. Stored durably so that an approval is
 * not silently discarded when the derivation effect re-runs after a sync.
 */
export interface ReviewDecision {
  /** stable, order-independent pair key */
  key: string;
  materialIdA: number;
  materialIdB: number;
  status: ReviewStatus;
  nationalCode?: string;
  by: string;
  at: string;
  note?: string;
}

/** A human decision that assigns one or more source records to an NMC. */
export interface MappingDecision {
  key: string;
  materialIds: number[];
  nationalCode: string;
  by: string;
  at: string;
  source: "REVIEW_APPROVAL" | "STEWARD_MAPPING";
  evidence?: MatchEvidence;
}

/**
 * The single rule for whether a candidate may become a national code. Kept in
 * one place so the review queue, bulk approval and the provider cannot drift
 * apart: a pair with a technical conflict is never approvable, whatever the
 * confidence score says.
 */
export function canApproveCandidate(
  item: Pick<ReviewItem, "autoMergeBlocked" | "evidence"> | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  const blocked = item?.autoMergeBlocked || Boolean(item?.evidence?.hasConflict);
  if (!blocked) return { ok: true };
  const conflicts = item?.evidence?.conflicts ?? [];
  const detail = conflicts.length
    ? conflicts.map((c) => `${c.label}: ${c.source ?? "not stated"} vs ${c.candidate ?? "not stated"}`).join("; ")
    : "the pair has a technical conflict";
  return {
    ok: false,
    reason: `Cannot merge: ${detail}. These specifications contradict each other, so a human must resolve the conflict before a national code can be assigned.`,
  };
}

/** The description a record should be compared as, honouring steward correction. */
export function comparableText(m: SourceMaterial): string {
  return m.stewardDescription || m.originalDescription;
}

export function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function decisionFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * A Mapping means: a human has assigned this source record to a national code.
 * It is therefore derived from real human decisions, not from the mere presence
 * of an AI score. AI recommendations live in `reviewItems` until approved.
 */
export function computeMappings(
  materials: SourceMaterial[],
  nmcs: NmcCode[],
  mappingDecisions: MappingDecision[],
): Mapping[] {
  const byId = new Map(materials.map((m) => [m.id, m]));
  const out: Mapping[] = [];
  let id = 1;

  // A record can be covered by more than one decision (for example a steward
  // assignment made after a pair was approved). The record itself resolves
  // this last-decision-wins, so the table must resolve it the same way,
  // otherwise one record would be listed against two different national codes.
  const winner = new Map<number, MappingDecision>();
  for (const d of mappingDecisions) {
    for (const mid of d.materialIds) winner.set(mid, d);
  }

  for (const [materialId, d] of winner) {
    const members = d.materialIds.map((mid) => byId.get(mid)).filter(Boolean) as SourceMaterial[];
    const m = byId.get(materialId);
    if (!m || !members.length) continue;
    const nationalDesc = nmcs.find((n) => n.nationalCode === d.nationalCode)?.description ?? d.nationalCode;
    out.push({
      id: id++,
      cpse: m.sourceOrganization,
      sourceCode: m.originalMaterialCode,
      rawDescription: m.originalDescription,
      normalizedDescription: m.normalizedDescription || m.originalDescription.toUpperCase(),
      nationalCode: d.nationalCode,
      nationalDesc: nationalDesc,
      mappingStatus: "MAPPED",
      confidence: d.evidence?.confidence ?? m.aiConfidence ?? undefined,
      mappingSource: d.source === "REVIEW_APPROVAL" ? "AI + Human Reviewer" : "Steward mapping",
      lastUpdated: d.at,
      createdBy: d.by,
      // Only ever the record's real source URL. A record without one is left
      // empty rather than pointed at a generic portal landing page.
      tenderDocName: m.sourceDocument,
      tenderUrl: m.sourceUrl || "",
      sourceCodeLabel: m.originalMaterialCode,
      evidence: d.evidence,
      approvedBy: d.by,
      approvedAt: d.at,
      decisionKey: d.key,
      lineage: members.map((x) => ({
        cpse: x.sourceOrganization,
        sourceCode: x.originalMaterialCode,
        sourceUrl: x.sourceUrl,
      })),
    });
  }

  return out;
}

/**
 * Candidate generation + scoring, delegated to the real matching engine
 * (src/lib/matching.ts, a port of ai-service/app/matcher.py).
 *
 * Only MATERIAL records participate: services, works and consultancy are
 * classified before matching and excluded, so they can never be matched
 * material-to-material.
 */
export function computeReviewItems(
  materials: SourceMaterial[],
  nmcs: NmcCode[],
  reviewDecisions: ReviewDecision[] = [],
): { items: ReviewItem[]; evaluated: number; rejected: number } {
  const decisionByKey = new Map(reviewDecisions.map((d) => [d.key, d]));
  const matchable = materials.filter((m) => isMatchable(m.recordType));

  const out: ReviewItem[] = [];
  let evaluated = 0;
  let rejected = 0;
  let id = 1;

  for (let i = 0; i < matchable.length; i++) {
    for (let j = i + 1; j < matchable.length; j++) {
      const a = matchable[i];
      const b = matchable[j];
      // A record is never a candidate for itself within the same CPSE notice set.
      if (a.sourceOrganization === b.sourceOrganization && a.sourceRecordId === b.sourceRecordId) continue;

      // A steward-corrected description is what the record now means, so it is
      // what gets compared; the raw source text stays untouched for audit.
      const evidence = compareRecords(
        comparableText(a),
        a.dna,
        comparableText(b),
        b.dna,
        a.originalUom,
        b.originalUom,
      );
      evaluated++;

      // backend MatchService.java:64 — below the floor a candidate is dropped.
      if (evidence.confidence < DECISION_POLICY.candidateFloor && !evidence.hasConflict) {
        rejected++;
        continue;
      }

      const rawSuggested =
        a.nmcCode ||
        b.nmcCode ||
        pickNmc(a.originalDescription, a.dna, nmcs) ||
        pickNmc(b.originalDescription, b.dna, nmcs) ||
        `${NATIONAL_CODE_PREFIX}-${getCategoryCode(a.category, a.originalDescription)}-000001`;
      const suggested = normalizeNmcCode(rawSuggested, a.originalDescription, a.category)!;

      const key = pairKey(a.id, b.id);
      const decided = decisionByKey.get(key);

      out.push({
        id: id++,
        cpseA: a.sourceOrganization,
        codeA: a.originalMaterialCode,
        descA: a.originalDescription,
        cpseB: b.sourceOrganization,
        codeB: b.originalMaterialCode,
        descB: b.originalDescription,
        suggestedNmc: decided?.nationalCode || suggested,
        suggestedDesc: a.normalizedDescription || a.originalDescription,
        confidence: evidence.confidence,
        reason: evidence.blockers.length
          ? evidence.blockers.join("; ")
          : evidence.reasons.join("; "),
        status: decided?.status ?? "PENDING",
        priority: evidence.hasConflict ? "HIGH" : evidence.confidence >= 0.8 ? "HIGH" : evidence.confidence >= 0.6 ? "MEDIUM" : "LOW",
        source: "Multi-layer matcher (description + Material DNA)",
        category: a.category,
        reviewedBy: decided?.by,
        note: decided?.note,
        evidence,
        classification: evidence.classification,
        recommendation: evidence.recommendation,
        materialIdA: a.id,
        materialIdB: b.id,
        autoMergeBlocked: evidence.hasConflict,
      });
    }
  }
  return { items: out, evaluated, rejected };
}

/** Durable steward remediation, keyed by the derived (stable) issue id. */
function loadDqRemediation(): Record<number, DqRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("nmm_dq_remediation");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return {};
    return Object.fromEntries(
      parsed
        .filter((r: DqRecord) => r && typeof r.id === "number")
        .map((r: DqRecord) => [r.id, r]),
    );
  } catch {
    return {};
  }
}

/**
 * Data-quality issues are derived from the record itself: every issue names the
 * field that is missing or contradictory, and carries the concrete action that
 * would resolve it. Ids are derived from the record + issue type so a steward's
 * remediation survives a recomputation.
 */
export function computeDqRecords(materials: SourceMaterial[]): DqRecord[] {
  const out: DqRecord[] = [];
  const now = new Date().toISOString();

  for (const m of materials) {
    const desc = (m.originalDescription || "").trim();
    const code = (m.originalMaterialCode || "").trim();
    const uom = (m.originalUom || "").trim();
    const dna = m.dna;
    const base = { cpse: m.sourceOrganization, sourceCode: code, rawDescription: desc };
    let seq = 0;

    const push = (
      issueType: string,
      severity: DqSeverity,
      dnaStatus: string,
      field: string,
      detail: string,
      action: string,
    ) => {
      out.push({
        id: m.id * 100 + seq++,
        ...base,
        extractedDescription: detail,
        dnaStatus,
        remediationRequired: true,
        field,
        recommendedAction: action,
        issueType,
        severity,
        status: "OPEN",
        lastUpdated: now,
      });
    };

    if (!code || code.length < 3) {
      push(
        "MISSING_SOURCE_CODE",
        "ERROR",
        "INCOMPLETE",
        "source material code",
        "The source record has no usable material code, so it cannot be traced back to a BOQ line.",
        "Obtain the BOQ item number from the source document and enter it as the source code.",
      );
    }

    if (!desc || desc.length < 5) {
      push(
        "MISSING_DESCRIPTION",
        "ERROR",
        "INCOMPLETE",
        "item description",
        "No item-level description was published, so no attributes can be extracted.",
        "Attach the BOQ line description; a notice title is not a substitute for an item description.",
      );
    }

    if (!m.itemLevel) {
      push(
        "NOTICE_LEVEL_RECORD",
        "WARNING",
        "PARTIAL",
        "record granularity",
        "This record is a tender/notice title rather than an item-level BOQ line, so it is not comparable to a material item.",
        "Extract the BOQ schedule item from the tender document to obtain a comparable record.",
      );
    }

    if (m.recordType !== "MATERIAL") {
      push(
        "NON_MATERIAL_RECORD",
        "WARNING",
        "COMPLETE",
        "record type",
        `Classified as ${m.recordType}, so it is deliberately excluded from material-to-material matching.`,
        "No remediation needed if this is correct. Reclassify only if the classification is wrong.",
      );
    }

    if (!uom || uom === "—") {
      push(
        "INVALID_UOM",
        "WARNING",
        "PARTIAL",
        "unit of measure",
        "No unit of measure was published, so quantity-based comparison is not possible.",
        "Enter the unit of measure from the BOQ so it can be normalised.",
      );
    }

    // Grade/size gaps are only meaningful for categories where they discriminate.
    const needsGrade = ["VALVE", "FASTENER", "PIPE", "STEEL", "ELECTRICAL", "GASKET"].includes(
      dna?.category ?? m.category,
    );
    if (needsGrade && !dna?.grade) {
      push(
        "MISSING_GRADE",
        "WARNING",
        "PARTIAL",
        "material grade",
        `No grade or material specification could be extracted from "${desc}", which lowers the confidence of every match this record takes part in.`,
        "Add the grade/class/standard (for example SS304, IS 11673) to the source description if the document contains one.",
      );
    }

    const needsSize = ["VALVE", "PIPE", "GASKET", "BEARING", "CABLE"].includes(dna?.category ?? m.category);
    if (needsSize && !dna?.size && !dna?.diameter) {
      push(
        "MISSING_SIZE",
        "WARNING",
        "PARTIAL",
        "size / diameter",
        `No size or diameter could be extracted from "${desc}", so records of different sizes cannot be told apart.`,
        "Add the nominal size or diameter from the BOQ so size-based conflict detection can work.",
      );
    }
  }

  return out;
}

/**
 * Distribution/insight metrics. The two "opportunity" numbers used to be
 * multiples of the record count; they are now counted from real candidates, and
 * coverage is counted from real human mapping decisions.
 */
export function computeProcurement(
  materials: SourceMaterial[],
  reviewItems: ReviewItem[],
  mappingDecisions: MappingDecision[],
): ProcurementInsight {
  const catMap = new Map<string, number>();
  materials.forEach((m) => {
    catMap.set(m.category, (catMap.get(m.category) || 0) + 1);
  });
  const categoryDistribution = Array.from(catMap.entries())
    .map(([category, records]) => ({ category, records }))
    .sort((a, b) => b.records - a.records);

  const cpseMap = new Map<string, number>();
  materials.forEach((m) => {
    cpseMap.set(m.sourceOrganization, (cpseMap.get(m.sourceOrganization) || 0) + 1);
  });
  const cpseVolume = Array.from(cpseMap.entries())
    .map(([cpse, records]) => ({ cpse, records }))
    .sort((a, b) => b.records - a.records);

  const assignedIds = new Set(mappingDecisions.flatMap((d) => d.materialIds));
  const total = materials.length;
  const mapped = materials.filter((m) => assignedIds.has(m.id)).length;
  const nmcCoverage = total > 0 ? Math.round((mapped / total) * 100) : 0;
  const unmappedPct = 100 - nmcCoverage;

  const topCats = categoryDistribution.slice(0, 4).map((c) => c.category);

  // Records grouped by the month they were actually retrieved, taken from each
  // record's own `retrievedAt`. This is a real count of ingested records, in
  // chronological order — not a spend figure and not a count of audit events.
  const byMonth = new Map<string, { sort: number; records: number }>();
  for (const m of materials) {
    const d = new Date(m.retrievedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = byMonth.get(key);
    if (entry) entry.records += 1;
    else byMonth.set(key, { sort: d.getTime(), records: 1 });
  }
  const trend = Array.from(byMonth.entries())
    .sort((a, b) => a[1].sort - b[1].sort)
    .map(([key, v]) => ({
      label: new Date(v.sort).toLocaleString("en-US", { month: "short", year: "2-digit" }),
      records: v.records,
    }));

  return {
    categoryDistribution,
    cpseVolume,
    nmcCoverage,
    unmappedPct,
    highValueCategories: topCats,
    standardizationOpps: reviewItems.filter(
      (r) => r.status === "PENDING" && !r.autoMergeBlocked && r.recommendation === "RECOMMEND_APPROVAL",
    ).length,
    duplicates: reviewItems.filter((r) => r.classification === "DUPLICATE").length,
    mappingCoverage: nmcCoverage,
    trend,
  };
}

/**
 * Every population here is counted from real records/candidates. Populations
 * are intentionally NOT nested in the UI, because e.g. "recommended" and
 * "pending review" are properties of candidates, while "normalized materials"
 * is a property of records — they are different denominators.
 */
export function computeMatchingStats(
  materials: SourceMaterial[],
  reviewItems: ReviewItem[],
  candidatesEvaluated: number,
  candidatesRejected: number,
  mappings: Mapping[],
): MatchingStats {
  const matchable = materials.filter((m) => isMatchable(m.recordType));
  return {
    sourceRecords: materials.length,
    matchableMaterials: matchable.length,
    excludedNonMaterial: materials.length - matchable.length,
    candidatesEvaluated,
    candidatesRejected,
    recommended: reviewItems.filter((r) => r.recommendation === "RECOMMEND_APPROVAL").length,
    blocked: reviewItems.filter((r) => r.autoMergeBlocked).length,
    pendingReview: reviewItems.filter((r) => r.status === "PENDING").length,
    approved: reviewItems.filter((r) => r.status === "APPROVED").length,
    rejected: reviewItems.filter((r) => r.status === "REJECTED").length,
    mapped: new Set(mappings.map((m) => m.nationalCode)).size,
  };
}

function seedAudit(): AuditEvent[] {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("nmm_audit");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
  }

  return [
    {
      id: 1,
      createdAt: new Date().toISOString(),
      actor: "system",
      action: "PLATFORM_INITIALIZED",
      entityType: "SYSTEM",
      entityId: 1,
      detail: "Platform initialized with official Government e-Marketplace (GeM), Coal India, BHEL, and CPPP live repositories.",
    },
  ];
}


export function PrototypeDataProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<Repo[]>(() => seedRepos());
  const [rawMaterials, setMaterials] = useState<SourceMaterial[]>(() => seedMaterials());
  const [nmcCodes, setNmcCodes] = useState<NmcCode[]>(() => seedNmcs());
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => seedAudit());
  /**
   * The decision log is the single source of truth for human judgement. Every
   * mapping and every review status is derived from it, so a decision can never
   * be silently overwritten by a recomputation.
   */
  const [reviewDecisions, setReviewDecisions] = useState<ReviewDecision[]>(() =>
    decisionFromStorage<ReviewDecision>("nmm_review_decisions"),
  );
  const [mappingDecisions, setMappingDecisions] = useState<MappingDecision[]>(() =>
    decisionFromStorage<MappingDecision>("nmm_mapping_decisions"),
  );

  const [lastMatchedAt, setLastMatchedAt] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  /** Steward remediation of a data-quality issue, kept as a durable override. */
  const [dqRemediation, setDqRemediation] = useState<Record<number, DqRecord>>(loadDqRemediation);

  /** A human assignment is reflected back onto the record itself. */
  const materials = useMemo(() => {
    const assigned = new Map<number, string>();
    for (const d of mappingDecisions) {
      for (const id of d.materialIds) assigned.set(id, d.nationalCode);
    }
    return rawMaterials.map((m) => {
      const code = assigned.get(m.id);
      return { ...m, nmcCode: code, mappingStatus: code ? "MAPPED" : "UNMAPPED" } as SourceMaterial;
    });
  }, [rawMaterials, mappingDecisions]);

  const reviewResult = useMemo(
    () => computeReviewItems(materials, nmcCodes, reviewDecisions),
    [materials, nmcCodes, reviewDecisions],
  );
  const reviewItems = reviewResult.items;
  const mappings = useMemo(
    () => computeMappings(materials, nmcCodes, mappingDecisions),
    [materials, nmcCodes, mappingDecisions],
  );
  const dqRecords = useMemo(() => {
    const base = computeDqRecords(materials);
    if (Object.keys(dqRemediation).length === 0) return base;
    return base.map((r) => dqRemediation[r.id] ?? r);
  }, [materials, dqRemediation]);
  const matchingStats = useMemo(
    () =>
      computeMatchingStats(
        materials,
        reviewItems,
        reviewResult.evaluated,
        reviewResult.rejected,
        mappings,
      ),
    [materials, reviewItems, reviewResult.evaluated, reviewResult.rejected, mappings],
  );
  const procurement = useMemo(
    () => computeProcurement(materials, reviewItems, mappingDecisions),
    [materials, reviewItems, mappingDecisions],
  );

  useEffect(() => {
    (async () => {
      try {
        const d = await api.dashboard();
        if (d && d.materialsImported > 0) setDashboard(d);
      } catch {
        /* proceed with local state */
      }
    })();
  }, []);

  // Persist the decision log so approvals survive reloads and re-syncs.
  useEffect(() => {
    try {
      localStorage.setItem("nmm_review_decisions", JSON.stringify(reviewDecisions));
    } catch {}
  }, [reviewDecisions]);
  useEffect(() => {
    try {
      localStorage.setItem("nmm_mapping_decisions", JSON.stringify(mappingDecisions));
    } catch {}
  }, [mappingDecisions]);
  // The audit trail is read back in seedAudit(), so it has to be written here
  // too. Without this every approval, revocation and sync disappears on reload
  // and the log claims the platform only ever initialised itself.
  useEffect(() => {
    try {
      localStorage.setItem("nmm_audit", JSON.stringify(auditEvents));
    } catch {}
  }, [auditEvents]);
  // Steward remediation has to outlive a reload, otherwise a corrected record
  // would come back with its data-quality issue re-opened.
  useEffect(() => {
    try {
      localStorage.setItem("nmm_dq_remediation", JSON.stringify(dqRemediation));
    } catch {}
  }, [dqRemediation]);

  // Synchronize repository record counts with actual materials in platform
  useEffect(() => {
    setRepos((prev) =>
      prev.map((r) => {
        const matchingCount = materials.filter((m) => {
          const org = m.sourceOrganization.toUpperCase();
          const rName = r.name.toUpperCase();
          if (org.includes(rName) || rName.includes(org)) return true;
          if (r.sourceKey && (m.sourceDocument.toLowerCase().includes(r.sourceKey) || org.toLowerCase().includes(r.sourceKey))) return true;
          return false;
        }).length;
        return { ...r, records: matchingCount };
      }),
    );
  }, [materials]);

  function pushAudit(action: string, entityType: string, entityId: number | string, detail: string, actor = "system") {
    const ev: AuditEvent = { id: Date.now(), createdAt: new Date().toISOString(), actor, action, entityType, entityId, detail };
    setAuditEvents((a) => [ev, ...a]);
  }

  const api_ = useMemo<ProtoState>(() => {
    return {
      loading,
      repos,
      materials,
      nmcCodes,
      mappings,
      reviewItems,
      dqRecords,
      auditEvents,
      procurement,
      matchingStats,
      dashboard,

      lastMatchedAt,

      connectRepository: (r) => {
        const id = Date.now();
        const repo: Repo = {
          id,
          name: r.name || "New CPSE Repository",
          url: r.url || "https://",
          type: r.type || "e-Procurement/CPPP",
          status: "CONNECTED",
          records: 0,
          lastSync: new Date().toISOString(),
          syncStatus: "PENDING",
          extractionStatus: "PENDING",
          health: "Healthy",
          category: r.category || "GENERAL",
        };
        setRepos((x) => [repo, ...x]);
        pushAudit("REPOSITORY_CONNECTED", "REPOSITORY", id, `Connected ${repo.name}`, "admin");
      },

      syncRepository: async (id) => {
        const repo = repos.find((r) => r.id === id);
        if (!repo) return;
        setRepos((x) => x.map((r) => (r.id === id ? { ...r, status: "SYNCING", syncStatus: "FETCHING_LIVE" } : r)));

        try {
          const sourceKey = repo.sourceKey || repo.name.toLowerCase();
          const liveData = await api.syncLiveRepository(sourceKey, 10);

          if (liveData && liveData.status === "SUCCESS" && Array.isArray(liveData.records)) {
            const nowIso = new Date().toISOString();
            const newRecords: SourceMaterial[] = liveData.records.map((rec: any, idx: number) => {
              const recId = Date.now() + idx;
              const dna = extractDna(rec.originalDescription);
              const docName = rec.sourceDocument || `${repo.name} live notice`;
              return {
                id: recId,
                sourceOrganization: rec.sourceOrganization || repo.name,
                originalMaterialCode: rec.originalMaterialCode || `REC-${recId}`,
                originalDescription: rec.originalDescription,
                originalUom: rec.originalUom || "EA",
                originalQuantity: String(rec.originalQuantity || "1"),
                normalizedDescription: normalizeDescription(rec.originalDescription),
                category: rec.category || guessCat(rec.originalDescription),
                lifecycle: "PENDING",
                // Unmapped until a human assigns a code. The AI may recommend,
                // but only a decision creates a mapping.
                mappingStatus: "UNMAPPED",
                nmcCode: undefined,
                // No fabricated score: the record has not been matched to
                // anything yet, so there is nothing to be confident about.
                aiConfidence: null,
                dataQuality: dna.grade || dna.material ? "COMPLETE" : "MISSING_GRADE",
                sourceDocument: docName,
                sourceUrl: rec.sourceUrl || repo.url,
                sourceRecordId: rec.sourceRecordId || rec.originalMaterialCode,
                recordType: classifyRecordType(rec.originalDescription),
                dna,
                // The fetcher returns notice/record titles. Whether the portal
                // exposed an item-level BOQ line is stated explicitly instead of
                // being assumed, so a notice title is never shown as a material.
                sourceTenderTitle: rec.sourceTenderTitle || docName,
                retrievedAt: rec.retrievedAt || nowIso,
                origin: "LIVE",
                itemLevel: rec.itemLevel === true,
              } satisfies SourceMaterial;
            });

            // Prevent duplicate material codes in state
            setMaterials((prev) => {
              const existingCodes = new Set(prev.map((p) => p.originalMaterialCode));
              const filtered = newRecords.filter((r) => !existingCodes.has(r.originalMaterialCode));
              const updated = [...filtered, ...prev];
              try {
                localStorage.setItem("nmm_materials", JSON.stringify(updated));
              } catch {}
              return updated;
            });

            const fetchedCount = newRecords.length;
            setRepos((x) => {
              const updated: Repo[] = x.map((r) =>
                r.id === id
                  ? {
                      ...r,
                      status: "CONNECTED",
                      syncStatus: "SYNCED",
                      extractionStatus: "EXTRACTED",
                      health: "Healthy",
                      lastSync: new Date().toISOString(),
                      records: r.records + fetchedCount,
                    }
                  : r
              );
              try {
                localStorage.setItem("nmm_repos", JSON.stringify(updated));
              } catch {}
              return updated;
            });

            pushAudit(
              "REPOSITORY_SYNCED",
              "REPOSITORY",
              id,
              `Live sync from ${repo.name}: fetched ${fetchedCount} genuine records from ${repo.url}`,
              "admin"
            );
          } else {
            throw new Error(liveData?.error || "No records returned");
          }
        } catch (err: any) {
          console.error("Live repository sync failed. No records were consolidated or persisted:", err);
          const errorText = err instanceof Error ? err.message : (err?.message || "Portal unreachable or request failed");

          setRepos((x) => {
            const updated: Repo[] = x.map((r) =>
              r.id === id
                ? {
                    ...r,
                    status: "ERROR",
                    syncStatus: "SYNC_ERROR",
                    extractionStatus: "FAILED",
                    health: "Attention",
                    lastSync: new Date().toISOString(),
                  }
                : r
            );
            try {
              localStorage.setItem("nmm_repos", JSON.stringify(updated));
            } catch {}
            return updated;
          });

          pushAudit(
            "REPOSITORY_SYNC_FAILED",
            "REPOSITORY",
            id,
            `Live sync for ${repo.name} failed: ${errorText}`,
            "admin"
          );
          throw err;
        }
      },

      syncAllRepositories: async () => {
        const targets = repos.filter((r) => r.status !== "DISCONNECTED");
        const failed: string[] = [];
        for (const r of targets) {
          try {
            await api_.syncRepository(r.id);
            await new Promise((res) => setTimeout(res, 800));
          } catch {
            failed.push(r.name);
          }
        }
        // Report what actually happened instead of claiming blanket success.
        if (failed.length > 0) {
          toast(
            "warning",
            "Sync finished with errors",
            `${failed.length} of ${targets.length} repositories failed: ${failed.join(", ")}`,
          );
        }
      },


      disconnectRepository: (id) => {
        setRepos((x) => x.map((r) => (r.id === id ? { ...r, status: "DISCONNECTED", health: "Offline" } : r)));
        pushAudit("REPOSITORY_DISCONNECTED", "REPOSITORY", id, "Repository disconnected", "admin");
      },

      importMaterials: (records, sourceDoc, note) => {
        const nowIso = new Date().toISOString();
        const padded: SourceMaterial[] = records.map((r, i) =>
          enrichRecord({
            ...r,
            id: Date.now() + i,
            sourceDocument: sourceDoc || r.sourceDocument,
            // An operator upload is not a portal fetch, so it is not called live.
            origin: "REFERENCE",
            retrievedAt: r.retrievedAt || nowIso,
            sourceTenderTitle: r.sourceTenderTitle || r.sourceDocument || sourceDoc || "",
            itemLevel: r.itemLevel ?? true,
          }),
        );
        setMaterials((m) => [...padded, ...m]);
        pushAudit(
          "MATERIALS_SYNCED",
          "IMPORT_JOB",
          Date.now(),
          `${records.length} records imported from ${sourceDoc}${note ? " — " + note : ""}`,
          "admin",
        );
      },

      runAiMatching: async () => {
        // Candidates are already derived reactively; this re-runs the real
        // engine explicitly and records an honest, complete summary.
        const result = computeReviewItems(materials, nmcCodes, reviewDecisions);
        const stats = computeMatchingStats(
          materials,
          result.items,
          result.evaluated,
          result.rejected,
          computeMappings(materials, nmcCodes, mappingDecisions),
        );
        setLastMatchedAt(new Date().toISOString());
        pushAudit(
          "MATCHING_RUN",
          "MATCHING_JOB",
          Date.now(),
          `Multi-layer matching evaluated ${result.evaluated} candidate pairs across ${stats.matchableMaterials} material records: ` +
            `${stats.recommended} recommended for approval, ${stats.blocked} blocked by technical conflicts, ` +
            `${result.rejected} below the ${DECISION_POLICY.candidateFloor} candidate floor.`,
          "ai-matcher",
        );
        return stats;
      },
      openReviewQueueFromMatch: () => {},

      changeMapping: (mappingId, newNmc, reviewer) => {
        const target = mappings.find((m) => m.id === mappingId);
        if (!target?.decisionKey) return;
        const at = new Date().toISOString();
        setMappingDecisions((decs) =>
          decs.map((d) => (d.key === target.decisionKey ? { ...d, nationalCode: newNmc, by: reviewer, at } : d)),
        );
        pushAudit("MAPPING_CHANGED", "MAPPING", mappingId, `Assignment changed to ${newNmc}`, reviewer);
      },

      removeMapping: (mappingId) => {
        const target = mappings.find((m) => m.id === mappingId);
        if (!target?.decisionKey) return;
        const key = target.decisionKey;
        setMappingDecisions((decs) => decs.filter((d) => d.key !== key));
        // Removing the assignment must also un-decide the pair, otherwise the
        // review queue would still report it as approved with no mapping
        // behind it.
        setReviewDecisions((decs) =>
          decs.map((d) => (d.key === key ? { ...d, status: "PENDING", nationalCode: undefined } : d)),
        );
        pushAudit("MAPPING_REMOVED", "MAPPING", mappingId, "Assignment removed; records returned to unmapped", "steward");
      },

      revokeMapping: (mappingId, reviewer, note) => {
        const target = mappings.find((m) => m.id === mappingId);
        if (!target?.decisionKey) return;
        const key = target.decisionKey;
        setMappingDecisions((decs) => decs.filter((d) => d.key !== key));
        // A revoked pair must also leave the review queue as undecided.
        setReviewDecisions((decs) =>
          decs.map((d) =>
            d.key === key
              ? { ...d, status: "PENDING", nationalCode: undefined }
              : d,
          ),
        );
        pushAudit("MAPPING_REVOKED", "MAPPING", mappingId, note || "Assignment revoked", reviewer);
      },

      updateReviewStatus: (id, status, reviewer, note) => {
        const item = reviewItems.find((r) => r.id === id);
        if (!item) return;
        const { materialIdA: idA, materialIdB: idB } = item;
        if (idA === undefined || idB === undefined) return;
        // The conflict rule is enforced here, not only in the UI, so no caller
        // can merge a pair whose attributes contradict each other.
        if (status === "APPROVED") {
          const verdict = canApproveCandidate(item);
          if (!verdict.ok) {
            toast("error", "Cannot approve", verdict.reason);
            return;
          }
        }
        const key = pairKey(idA, idB);
        const at = new Date().toISOString();

        setReviewDecisions((decs) => [
          ...decs.filter((d) => d.key !== key),
          {
            key,
            materialIdA: idA,
            materialIdB: idB,
            status,
            nationalCode: status === "APPROVED" ? item.suggestedNmc : undefined,
            by: reviewer,
            at,
            note,
          },
        ]);

        if (status === "APPROVED") {
          // A human approval is what creates the mapping, never the score.
          setMappingDecisions((decs) => [
            ...decs.filter((d) => d.key !== key),
            {
              key,
              materialIds: [idA, idB],
              nationalCode: item.suggestedNmc,
              by: reviewer,
              at,
              source: "REVIEW_APPROVAL",
              evidence: item.evidence,
            },
          ]);
          pushAudit(
            "MATCH_APPROVED",
            "MATCH_RECOMMENDATION",
            id,
            `Approved and assigned ${item.suggestedNmc} (match confidence ${(item.confidence * 100).toFixed(1)}%)`,
            reviewer,
          );
        } else {
          setMappingDecisions((decs) => decs.filter((d) => d.key !== key));
          pushAudit(
            status === "REJECTED" ? "MATCH_REJECTED" : "MATCH_REOPENED",
            "MATCH_RECOMMENDATION",
            id,
            note || (status === "REJECTED" ? "Rejected by reviewer" : "Reopened for review"),
            reviewer,
          );
        }
      },

      /**
       * Bulk approval refuses anything the engine blocked and reports how many
       * were skipped, instead of silently approving conflicting pairs.
       */
      bulkUpdateReviewStatus: (ids, reviewer) => {
        const picked = reviewItems.filter((r) => ids.includes(r.id));
        const blocked = picked.filter((r) => !canApproveCandidate(r).ok);
        const approvable = picked.filter((r) => canApproveCandidate(r).ok);

        for (const item of approvable) {
          const { materialIdA: idA, materialIdB: idB } = item;
          if (idA === undefined || idB === undefined) continue;
          const key = pairKey(idA, idB);
          const at = new Date().toISOString();
          setReviewDecisions((decs) => [
            ...decs.filter((d) => d.key !== key),
            {
              key,
              materialIdA: idA,
              materialIdB: idB,
              status: "APPROVED",
              nationalCode: item.suggestedNmc,
              by: reviewer,
              at,
              note: "Bulk approved",
            },
          ]);
          setMappingDecisions((decs) => [
            ...decs.filter((d) => d.key !== key),
            {
              key,
              materialIds: [idA, idB],
              nationalCode: item.suggestedNmc,
              by: reviewer,
              at,
              source: "REVIEW_APPROVAL",
              evidence: item.evidence,
            },
          ]);
        }

        pushAudit(
          "BULK_UPDATE",
          "MATCH_RECOMMENDATION",
          ids.length,
          `${approvable.length} pair(s) approved by ${reviewer}` +
            (blocked.length
              ? `; ${blocked.length} pair(s) with technical conflicts were skipped and left for individual review`
              : ""),
          reviewer,
        );
        if (blocked.length) {
          toast(
            "warning",
            "Some pairs were not approved",
            `${blocked.length} pair(s) have technical conflicts and need individual review.`,
          );
        }
      },

      mapMaterialToNmc: (materialId, nmc) => {
        const key = `steward-${materialId}`;
        const at = new Date().toISOString();
        setMappingDecisions((decs) => [
          ...decs.filter((d) => d.key !== key),
          { key, materialIds: [materialId], nationalCode: nmc, by: "steward", at, source: "STEWARD_MAPPING" },
        ]);
        pushAudit("MAPPING_CREATED", "SOURCE_MATERIAL", materialId, `Assigned to ${nmc} by steward`, "steward");
      },

      remediateDq: (id, patch) => {
        setDqRemediation((prev) => {
          const base = dqRecords.find((r) => r.id === id);
          if (!base) return prev;
          return {
            ...prev,
            [id]: { ...base, ...patch, status: "REMEDIATED", lastUpdated: new Date().toISOString(), remediationRequired: false },
          };
        });
        // Ids are derived from the source record, so the correction can be
        // pushed back onto the record itself. The raw source text is never
        // overwritten: the steward's wording is stored as the normalized
        // description, which is what the matcher actually compares.
        const sourceId = Math.floor(id / 100);
        const corrected = typeof patch.extractedDescription === "string" ? patch.extractedDescription : null;
        if (corrected) {
          setMaterials((prev) =>
            prev.map((m) =>
              m.id !== sourceId
                ? m
                : {
                    ...m,
                    stewardDescription: corrected,
                    normalizedDescription: normalizeDescription(corrected),
                    recordType: classifyRecordType(corrected),
                    dna: extractDna(corrected),
                    dataQuality: extractDna(corrected).grade ? "COMPLETE" : "MISSING_GRADE",
                  },
            ),
          );
        }
        pushAudit("DATA_REMEDIATED", "DATA_QUALITY", id, "Record remediated by steward", "steward");
      },
      /**
       * Re-submitting remediated records re-runs the real extractor and matcher
       * over them. No synthetic candidate pair with an invented score is made.
       */
      sendDqToAi: (ids) => {
        // Issue ids are derived from the record id, so the record is addressed
        // directly. Matching on the source code instead would catch unrelated
        // records that happen to share a code across organisations.
        const affectedIds = new Set(ids.map((id) => Math.floor(id / 100)));
        const affected = materials.filter((m) => affectedIds.has(m.id));
        if (affected.length === 0) {
          pushAudit("SENT_TO_MATCHING", "DATA_QUALITY", ids.length, "No matching source records found for the selected issues", "steward");
          return;
        }
        setMaterials((x) =>
          x.map((mm) => {
            if (!affectedIds.has(mm.id)) return mm;
            // Re-extract from the corrected text when there is one, so this
            // re-runs the pipeline on the steward's wording rather than
            // silently reverting to the raw source description.
            const text = mm.stewardDescription || mm.originalDescription;
            const dna = extractDna(text);
            return {
              ...mm,
              dna,
              recordType: classifyRecordType(text),
              normalizedDescription: normalizeDescription(text),
              dataQuality: dna.grade || dna.material ? "COMPLETE" : "MISSING_GRADE",
            };
          }),
        );
        pushAudit(
          "SENT_TO_MATCHING",
          "DATA_QUALITY",
          ids.length,
          `${affected.length} record(s) re-extracted and re-evaluated by the matcher; candidate pairs update automatically from the new attributes.`,
          "steward",
        );
      },
    };
  }, [loading, repos, materials, nmcCodes, mappings, reviewItems, dqRecords, auditEvents, procurement, matchingStats, dashboard, lastMatchedAt, reviewDecisions, mappingDecisions]);

  return <ProtoContext.Provider value={api_}>{children}</ProtoContext.Provider>;
}

export function useProto() {
  const ctx = useContext(ProtoContext);
  if (!ctx) throw new Error("useProto must be used within PrototypeDataProvider");
  return ctx;
}

export { capStr };
