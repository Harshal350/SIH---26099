import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { api } from "@/lib/api";

export type RepoStatus = "CONNECTED" | "SYNCING" | "ERROR" | "DISCONNECTED";
export type MappingStatus = "MAPPED" | "PENDING" | "REVIEW" | "UNMAPPED";
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_CLARIFICATION";
export type DqSeverity = "ERROR" | "WARNING";
export type DqStatus = "OPEN" | "REMEDIATED" | "REVIEW";

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
  confidence: number;
  mappingSource: string;
  lastUpdated: string;
  createdBy: string;
  tenderDocName: string;
  tenderUrl: string;
  sourceCodeLabel: string;
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
  nmcCoverage: number;
  unmappedPct: number;
  highValueCategories: string[];
  standardizationOpps: number;
  duplicates: number;
  mappingCoverage: number;
  trend: { label: string; spend: number }[];
}

export interface MatchingStats {
  processed: number;
  highConfidence: number;
  review: number;
  unmatched: number;
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
  disconnectRepository: (id: number) => void;

  importMaterials: (records: SourceMaterial[], sourceDoc: string, note?: string) => void;

  runAiMatching: () => Promise<MatchingStats>;
  openReviewQueueFromMatch: () => void;

  approveMapping: (mappingId: number, reviewer: string, note?: string) => void;
  rejectMapping: (mappingId: number, reviewer: string, note?: string) => void;
  changeMapping: (mappingId: number, newNmc: string, reviewer: string) => void;
  removeMapping: (mappingId: number) => void;

  updateReviewStatus: (id: number, status: ReviewStatus, reviewer: string, note?: string) => void;
  bulkUpdateReviewStatus: (ids: number[], status: ReviewStatus, reviewer: string) => void;

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
  const repos: Repo[] = [
    { id: 1, name: "IOCL e-Procurement", url: "https://eproc.iocl.com", type: "e-Procurement/CPPP", status: "CONNECTED", records: 4820, lastSync: daysAgo(0), syncStatus: "SYNCED", extractionStatus: "EXTRACTED", health: "Healthy", category: "REFINING" },
    { id: 2, name: "BPCL Tender Portal", url: "https://eproc.bpcl.in", type: "e-Procurement/CPPP", status: "CONNECTED", records: 3690, lastSync: daysAgo(ils(0, 1)), syncStatus: "SYNCED", extractionStatus: "EXTRACTED", health: "Healthy", category: "REFINING" },
    { id: 3, name: "HPCL GeM Catalogue", url: "https://gem.gov.in", type: "GeM", status: "CONNECTED", records: 5280, lastSync: daysAgo(1), syncStatus: "SYNCED", extractionStatus: "EXTRACTING", health: "Healthy", category: "REFINING" },
    { id: 4, name: "ONGC e-Bidding", url: "https://etender.ongc.co.in", type: "e-Procurement/CPPP", status: "CONNECTED", records: 2740, lastSync: daysAgo(2), syncStatus: "SYNCED", extractionStatus: "EXTRACTED", health: "Healthy", category: "E&P" },
    { id: 5, name: "GAIL EPTD", url: "https://etender.gail.co.in", type: "e-Procurement/CPPP", status: "CONNECTED", records: 1930, lastSync: daysAgo(3), syncStatus: "SYNC_ERROR", extractionStatus: "EXTRACTING", health: "Attention", category: "GAS" },
    { id: 6, name: "NTPC e-Tendering", url: "https://eprocure.gov.in", type: "e-Procurement/CPPP", status: "CONNECTED", records: 6310, lastSync: daysAgo(0), syncStatus: "SYNCED", extractionStatus: "EXTRACTED", health: "Healthy", category: "POWER" },
    { id: 7, name: "BHEL ERP Material", url: "https://bhel.com", type: "CPSE_PORTAL", status: "DISCONNECTED", records: 0, lastSync: daysAgo(30), syncStatus: "—", extractionStatus: "—", health: "Offline", category: "EQUIPMENT" },
    { id: 8, name: "SAIL e-Procurement", url: "https://eproc.sail.co.in", type: "e-Procurement/CPPP", status: "CONNECTED", records: 4450, lastSync: daysAgo(1), syncStatus: "SYNCED", extractionStatus: "EXTRACTED", health: "Healthy", category: "STEEL" },
  ];
  return repos;
}

function ils(a: number, b: number) {
  return a + Math.round(Math.random() * (b - a));
}

function seedNmcs(): NmcCode[] {
  const cats: [string, string][] = [
    ["NMC-000001", "GATE VALVE DN80 PN16 CAST STEEL"],
    ["NMC-000002", "CABLE 1.5 SQMM 3 CORE 1100V"],
    ["NMC-000003", "HEX HEAD BOLT STAINLESS STEEL M16 X 50MM"],
    ["NMC-000004", "CENTRIFUGAL WATER PUMP 5 HP FLANGE MOUNTED"],
    ["NMC-000005", "BALL VALVE 2 INCH SS304 PN16"],
    ["NMC-000006", "NON ASBESTOS GASKET SHEET 3MM"],
    ["NMC-000007", "CARBON STEEL PIPE SCH40 DN100"],
    ["NMC-000008", "INDUCTION MOTOR 3 PHASE 15 KW 415V"],
    ["NMC-000009", "PRESSURE GAUGE 0-16 BAR BOTTOM ENTRY"],
    ["NMC-000010", "SOLID CARBIDE DRILL BIT 10MM"],
    ["NMC-000011", "WELDING ELECTRODE E7018 4MM"],
    ["NMC-000012", "FIRE EXTINGUISHER ABC 9KG"],
  ];
  const out: NmcCode[] = [];
  cats.forEach(([code, desc]) => {
    out.push({ nationalCode: code, description: desc, category: guessCat(desc), status: "APPROVED" });
  });
  for (let i = 13; i <= 26; i++) {
    const code = `NMC-${String(i).padStart(6, "0")}`;
    out.push({ nationalCode: code, description: `STANDARD MATERIAL ${i}`, category: "GENERAL", status: "DRAFT" });
  }
  return out;
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

const descSamples: Record<string, [string, string, string, string][]> = {
  IOCL: [
    ["1001001", "HEX HEAD BOLT STAINLESS STEEL M16 X 50MM", "FASTENER", "EA"],
    ["1001003", "HEX HEAD BOLT 16MM X 50MM", "FASTENER", "EA"],
    ["1001005", "GATE VALVE DN80 CLASS150 FLANGED CAST STEEL", "VALVE", "EA"],
    ["1001007", "PVC CABLE 1.5 SQ MM 4 CORE 1100V", "ELECTRICAL", "M"],
    ["1001009", "CENTRIFUGAL WATER PUMP 5 HP FLANGE MOUNTED", "PUMP", "EA"],
  ],
  BPCL: [
    ["1001002", "SS BOLT M16 50MM HEX HEAD", "FASTENER", "EA"],
    ["1001004", "GATE VALVE DN80 PN16 CAST STEEL BODY", "VALVE", "EA"],
    ["1001010", "PVC CABLE 1.5 SQ MM 3 CORE 1100V", "ELECTRICAL", "M"],
    ["1001012", "WATER PUMP 5 HP FLANGE MOUNTED END SUCTION", "PUMP", "EA"],
    ["1001018", "NON ASBESTOS GASKET SHEET 3MM", "GASKET", "RM"],
  ],
  HPCL: [
    ["HM-2010", "BOLT HEX M16 X 50 ASME B18.2.1", "FASTENER", "EA"],
    ["HM-2080", "GATE VALVE 80NB PN16 CF8", "VALVE", "EA"],
    ["HM-2210", "GLOBAL ELASTIC CABLE 1.5SQ 3C 1.1KV", "ELECTRICAL", "M"],
    ["HM-2300", "CENTRIFUGAL PUMP 5HP END SUCTION 2900RPM", "PUMP", "EA"],
  ],
  GAIL: [
    ["GT-1500", "BALL VALVE 2INCH SS316 PN16", "VALVE", "EA"],
    ["GT-1600", "ELECTRIC MOTOR 15KW 3PH 415V", "MOTOR", "EA"],
    ["GT-1700", "GASKET SHEET 3MM NON ASBESTOS", "GASKET", "RM"],
  ],
  NTPC: [
    ["NT-3010", "PIPE CS SCH40 DN100 6M LENGTH", "PIPE", "M"],
    ["NT-3050", "PRESSURE GAUGE BOTTOM ENTRY 0-16 BAR", "INSTRUMENT", "EA"],
    ["NT-3100", "DRILL BIT CARBIDE 10MM", "TOOLS", "EA"],
  ],
};

const nmcHints: Record<string, string> = {
  "HEX HEAD BOLT": "NMC-000003",
  "GATE VALVE": "NMC-000001",
  "CABLE": "NMC-000002",
  "WATER PUMP": "NMC-000004",
  "CENTRIFUGAL WATER PUMP": "NMC-000004",
  "CENTRIFUGAL PUMP": "NMC-000004",
  "GASKET": "NMC-000006",
  "BALL VALVE": "NMC-000005",
  "PIPE": "NMC-000007",
  "MOTOR": "NMC-000008",
  "PRESSURE GAUGE": "NMC-000009",
  "DRILL": "NMC-000010",
};

function pickNmc(desc: string): string | undefined {
  const keys = Object.keys(nmcHints).sort((a, b) => b.length - a.length);
  for (const k of keys) if (desc.toUpperCase().includes(k.toUpperCase())) return nmcHints[k];
  return undefined;
}

function seedMaterials(): SourceMaterial[] {
  const out: SourceMaterial[] = [];
  let id = 1;
  Object.entries(descSamples).forEach(([org, rows]) => {
    rows.forEach(([code, desc, cat, uom], idx) => {
      const nmc = pickNmc(desc);
      let mappingStatus: MappingStatus = "UNMAPPED";
      if (nmc && idx % 3 === 0) mappingStatus = "MAPPED";
      else mappingStatus = "PENDING";
      out.push({
        id: id++,
        sourceOrganization: org,
        originalMaterialCode: code,
        originalDescription: desc,
        originalUom: uom,
        originalQuantity: String(2 + (id * 7) % 200),
        normalizedDescription: desc,
        category: cat,
        lifecycle: "ACTIVE",
        mappingStatus,
        nmcCode: mappingStatus === "MAPPED" ? nmc : undefined,
        aiConfidence: mappingStatus === "MAPPED" ? 0.85 + (hash(id) % 10) / 100 : null,
        dataQuality: (id * 13) % 7 === 0 ? "ATTENTION" : "CLEAN",
        sourceDocument: `${org} Material Master (illustrative)`,
        sourceUrl: `https://example-cpse.in/materials/${code}`,
        sourceRecordId: `SRC-${id}`,
      });
    });
  });
  return out;
}

function hash(n: number) {
  return (n * 2654435761) % 1000;
}

function seedMappings(): Mapping[] {
  const out: Mapping[] = [];
  let id = 1;
  Object.entries(descSamples).forEach(([org, rows]) => {
    rows.forEach(([code, desc, cat]) => {
      const nmc = pickNmc(desc);
      if (!nmc) return;
      const mapped = id % 3 !== 0;
      out.push({
        id: id++,
        cpse: org,
        sourceCode: code,
        rawDescription: desc,
        normalizedDescription: desc,
        nationalCode: nmc,
        nationalDesc: nmcCodesById[nmc] || desc,
        mappingStatus: mapped ? "MAPPED" : "REVIEW",
        confidence: 0.78 + (hash(id) % 18) / 100,
        mappingSource: mapped ? "AI + Reviewer" : "AI suggestive",
        lastUpdated: daysAgo((id * 3) % 10),
        createdBy: mapped ? (id % 2 ? "steward" : "ai-batch-07") : "ai-suggest",
        tenderDocName: `${org} Tender BOQ ${2000 + id}`,
        tenderUrl: `https://eproc.example.in/${org.toLowerCase()}/tender/${2000 + id}`,
        sourceCodeLabel: code,
      });
    });
  });
  return out;
}

const nmcCodesById: Record<string, string> = {
  "NMC-000001": "GATE VALVE DN80 PN16 CAST STEEL",
  "NMC-000002": "CABLE 1.5 SQMM 3 CORE 1100V",
  "NMC-000003": "HEX HEAD BOLT STAINLESS STEEL M16 X 50MM",
  "NMC-000004": "CENTRIFUGAL WATER PUMP 5 HP FLANGE MOUNTED",
  "NMC-000005": "BALL VALVE 2 INCH SS304 PN16",
  "NMC-000006": "NON ASBESTOS GASKET SHEET 3MM",
  "NMC-000007": "CARBON STEEL PIPE SCH40 DN100",
  "NMC-000008": "INDUCTION MOTOR 3 PHASE 15 KW 415V",
  "NMC-000009": "PRESSURE GAUGE 0-16 BAR BOTTOM ENTRY",
  "NMC-000010": "SOLID CARBIDE DRILL BIT 10MM",
};

function seedReviewItems(): ReviewItem[] {
  const pending: ReviewItem[] = [
    { id: 1, cpseA: "IOCL", codeA: "1001005", descA: "GATE VALVE DN80 CLASS150 FLANGED CAST STEEL", cpseB: "BPCL", codeB: "1001004", descB: "GATE VALVE DN80 PN16 CAST STEEL BODY", suggestedNmc: "NMC-000001", suggestedDesc: "GATE VALVE DN80 PN16 CAST STEEL", confidence: 0.87, reason: "Same category, matching DNA (type, size, pressure).", status: "PENDING", priority: "HIGH", source: "AI Multi-Layer Match", category: "VALVE" },
    { id: 2, cpseA: "IOCL", codeA: "1001001", descA: "HEX HEAD BOLT STAINLESS STEEL M16 X 50MM", cpseB: "HPCL", codeB: "HM-2010", descB: "BOLT HEX M16 X 50 ASME B18.2.1", suggestedNmc: "NMC-000003", suggestedDesc: "HEX HEAD BOLT STAINLESS STEEL M16 X 50MM", confidence: 0.91, reason: "Nearly identical fastener spec after normalization.", status: "PENDING", priority: "HIGH", source: "AI Multi-Layer Match", category: "FASTENER" },
    { id: 3, cpseA: "BPCL", codeA: "1001012", descA: "WATER PUMP 5 HP FLANGE MOUNTED END SUCTION", cpseB: "HPCL", codeB: "HM-2300", descB: "CENTRIFUGAL PUMP 5HP END SUCTION 2900RPM", suggestedNmc: "NMC-000004", suggestedDesc: "CENTRIFUGAL WATER PUMP 5 HP FLANGE MOUNTED", confidence: 0.78, reason: "Same functional equivalent, horsepower and mounting match.", status: "PENDING", priority: "MEDIUM", source: "AI Multi-Layer Match", category: "PUMP" },
    { id: 4, cpseA: "BPCL", codeA: "1001018", descA: "NON ASBESTOS GASKET SHEET 3MM", cpseB: "GAIL", codeB: "GT-1700", descB: "GASKET SHEET 3MM NON ASBESTOS", suggestedNmc: "NMC-000006", suggestedDesc: "NON ASBESTOS GASKET SHEET 3MM", confidence: 0.95, reason: "High lexical and meaning similarity; no technical conflicts.", status: "PENDING", priority: "HIGH", source: "AI Multi-Layer Match", category: "GASKET" },
    { id: 5, cpseA: "NTPC", codeA: "NT-3050", descA: "PRESSURE GAUGE BOTTOM ENTRY 0-16 BAR", cpseB: "GAIL", codeB: "GT-1600", descB: "ELECTRIC MOTOR 15KW 3PH 415V", suggestedNmc: "NMC-000009", suggestedDesc: "PRESSURE GAUGE 0-16 BAR BOTTOM ENTRY", confidence: 0.55, reason: "Same broad category but different technical nature; requires human review.", status: "PENDING", priority: "LOW", source: "AI suggestive", category: "INSTRUMENT" },
    { id: 6, cpseA: "IOCL", codeA: "1001009", descA: "CENTRIFUGAL WATER PUMP 5 HP FLANGE MOUNTED", cpseB: "NTPC", codeB: "NT-3010", descB: "PIPE CS SCH40 DN100 6M LENGTH", suggestedNmc: "NMC-000007", suggestedDesc: "CARBON STEEL PIPE SCH40 DN100", confidence: 0.4, reason: "Conflicting category — pump vs pipe. Flagged for manual review.", status: "PENDING", priority: "LOW", source: "AI suggestive", category: "PUMP" },
  ];
  const approved: ReviewItem[] = [
    { id: 10, cpseA: "IOCL", codeA: "1001003", descA: "HEX HEAD BOLT 16MM X 50MM", cpseB: "BPCL", codeB: "1001002", descB: "SS BOLT M16 50MM HEX HEAD", suggestedNmc: "NMC-000003", suggestedDesc: "HEX HEAD BOLT STAINLESS STEEL M16 X 50MM", confidence: 0.88, reason: "Identical fastener resolved.", status: "APPROVED", priority: "HIGH", source: "AI Multi-Layer Match", category: "FASTENER", reviewedBy: "steward", note: "Approved after verifying grade" },
    { id: 11, cpseA: "GAIL", codeA: "GT-1500", descA: "BALL VALVE 2INCH SS316 PN16", cpseB: "HPCL", codeB: "HM-2080", descB: "GATE VALVE 80NB PN16 CF8", suggestedNmc: "NMC-000005", suggestedDesc: "BALL VALVE 2 INCH SS304 PN16", confidence: 0.9, reason: "Ball valve dimensional match.", status: "APPROVED", priority: "HIGH", source: "AI Multi-Layer Match", category: "VALVE", reviewedBy: "steward" },
  ];
  const rejected: ReviewItem[] = [
    { id: 20, cpseA: "HPCL", codeA: "HM-2210", descA: "GLOBAL ELASTIC CABLE 1.5SQ 3C 1.1KV", cpseB: "IOCL", codeB: "1001007", descB: "PVC CABLE 1.5 SQ MM 4 CORE 1100V", suggestedNmc: "NMC-000002", suggestedDesc: "CABLE 1.5 SQMM 3 CORE 1100V", confidence: 0.68, reason: "Core count differs (3 vs 4 core) — not mergable.", status: "REJECTED", priority: "MEDIUM", source: "AI Multi-Layer Match", category: "ELECTRICAL", reviewedBy: "reviewer1", note: "Core count mismatch" },
  ];
  // pad to ~30 items with generated illustrative ones
  let n = pending.length + approved.length + rejected.length;
  for (let i = n + 1; i <= 42; i++) {
    const r = Math.random();
    const status: ReviewStatus = i % 5 === 0 ? "APPROVED" : i % 6 === 0 ? "REJECTED" : "PENDING";
    const conf = Math.round((0.45 + Math.random() * 0.5) * 100) / 100;
    pending.push({
      id: i,
      cpseA: "IOCL", codeA: `P-${i}`, descA: `ILLUSTRATIVE MATERIAL ITEM ${i} TYPE A`,
      cpseB: "BPCL", codeB: `P-${i + 100}`, descB: `ILLUSTRATIVE MATERIAL ITEM ${i} TYPE B`,
      suggestedNmc: `NMC-${String(10 + (i % 6)).padStart(6, "0")}`,
      suggestedDesc: `STANDARD MATERIAL ${i}`,
      confidence: conf,
      reason: "Illustrative match candidate generated for review queue demo.",
      status, priority: conf >= 0.8 ? "HIGH" : conf >= 0.6 ? "MEDIUM" : "LOW",
      source: "AI Multi-Layer Match", category: "GENERAL",
      reviewedBy: status === "APPROVED" || status === "REJECTED" ? "steward" : undefined,
      note: status === "REJECTED" ? "Rejected during illustrative review" : status === "APPROVED" ? "Approved" : undefined,
    });
  }
  return [...pending, ...approved, ...rejected];
}

function seedDqRecords(): DqRecord[] {
  const types = [
    ["MISSING_SOURCE_CODE", "Missing source code", "ERROR"],
    ["INVALID_CODE", "Invalid code format", "ERROR"],
    ["MISSING_DESCRIPTION", "Missing description", "WARNING"],
    ["DUPLICATE_MATERIAL", "Duplicate material", "WARNING"],
    ["POOR_EXTRACTION", "Poor extraction quality", "WARNING"],
    ["INCOMPLETE_NORMALIZATION", "Incomplete normalization", "WARNING"],
    ["AMBIGUOUS_CATEGORY", "Ambiguous category", "WARNING"],
    ["INVALID_MAPPING", "Invalid national-code mapping", "ERROR"],
  ] as const;
  const out: DqRecord[] = [];
  let n = 1;
  for (let i = 0; i < types.length; i++) {
    for (let j = 0; j < 3; j++) {
      const [issue, label, sev] = types[i];
      out.push({
        id: n++,
        cpse: ["IOCL", "BPCL", "HPCL", "GAIL", "NTPC"][(i + j) % 5],
        sourceCode: `RAW-${1000 + n}`,
        rawDescription: `Raw material ${n} with ${label.toLowerCase()}`,
        extractedDescription: label,
        dnaStatus: j === 0 ? "INCOMPLETE" : "PARTIAL",
        remediationRequired: true,
        issueType: issue,
        severity: sev as DqSeverity,
        status: i === types.length - 1 && j === 0 ? "REMEDIATED" : "OPEN",
        lastUpdated: daysAgo((n * 2) % 8),
      });
    }
  }
  return out;
}

function seedProcurement(): ProcurementInsight {
  return {
    categoryDistribution: [
      { category: "Valves", records: 1240 },
      { category: "Fasteners", records: 980 },
      { category: "Electrical", records: 820 },
      { category: "Pumps", records: 640 },
      { category: "Pipes & Gaskets", records: 520 },
      { category: "Instruments", records: 310 },
    ],
    cpseVolume: [
      { cpse: "NTPC", records: 6310 },
      { cpse: "HPCL", records: 5280 },
      { cpse: "IOCL", records: 4820 },
      { cpse: "SAIL", records: 4450 },
      { cpse: "BPCL", records: 3690 },
      { cpse: "ONGC", records: 2740 },
    ],
    nmcCoverage: 64,
    unmappedPct: 21,
    highValueCategories: ["Valves", "Pumps", "Electrical", "Rotating Equipment"],
    standardizationOpps: 18,
    duplicates: 1342,
    mappingCoverage: 79,
    trend: [
      { label: "Jan", spend: 820 },
      { label: "Feb", spend: 940 },
      { label: "Mar", spend: 1010 },
      { label: "Apr", spend: 1180 },
      { label: "May", spend: 1240 },
      { label: "Jun", spend: 1390 },
    ],
  };
}

function seedAudit(): AuditEvent[] {
  const events: AuditEvent[] = [
    { id: 1, createdAt: daysAgo(3), actor: "admin", action: "SOURCE_IMPORTED", entityType: "IMPORT_JOB", entityId: 1, detail: "IOCL material master imported" },
    { id: 2, createdAt: daysAgo(3), actor: "admin", action: "SOURCE_IMPORTED", entityType: "IMPORT_JOB", entityId: 2, detail: "BPCL material master imported" },
    { id: 3, createdAt: daysAgo(2), actor: "steward", action: "MATCH_APPROVED", entityType: "MATCH_RECOMMENDATION", entityId: 10, detail: "Approved and linked to NMC-000003" },
    { id: 4, createdAt: daysAgo(2), actor: "steward", action: "MATCH_APPROVED", entityType: "MATCH_RECOMMENDATION", entityId: 11, detail: "Approved and linked to NMC-000005" },
    { id: 5, createdAt: daysAgo(1), actor: "reviewer1", action: "MATCH_REJECTED", entityType: "MATCH_RECOMMENDATION", entityId: 20, detail: "Core count mismatch" },
    { id: 6, createdAt: daysAgo(0), actor: "ai-batch-07", action: "MATCHING_RUN", entityType: "MATCHING_JOB", entityId: 7, detail: "9,820 high-confidence matches" },
  ];
  for (let i = 7; i <= 24; i++) {
    events.push({
      id: i,
      createdAt: daysAgo(Math.floor(i / 3)),
      actor: i % 2 ? "steward" : "reviewer1",
      action: i % 4 === 0 ? "MAPPING_CHANGED" : i % 3 === 0 ? "DATA_REMEDIATED" : "MAPPING_APPROVED",
      entityType: "MAPPING",
      entityId: i * 5,
      detail: "Illustrative audit event",
    });
  }
  return events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function PrototypeDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [repos, setRepos] = useState<Repo[]>(() => seedRepos());
  const [materials, setMaterials] = useState<SourceMaterial[]>(() => seedMaterials());
  const [nmcCodes, setNmcCodes] = useState<NmcCode[]>(() => seedNmcs());
  const [mappings, setMappings] = useState<Mapping[]>(() => seedMappings());
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(() => seedReviewItems());
  const [dqRecords, setDqRecords] = useState<DqRecord[]>(() => seedDqRecords());
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => seedAudit());
  const [procurement, setProcurement] = useState<ProcurementInsight>(() => seedProcurement());
  const [matchingStats, setMatchingStats] = useState<MatchingStats>({
    processed: 12450,
    highConfidence: 9820,
    review: 1940,
    unmatched: 690,
  });
  const [lastMatchedAt, setLastMatchedAt] = useState<string | null>("2026-09-02T09:00:00.000Z");
  const [dashboard, setDashboard] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.dashboard();
        if (d && d.materialsImported > 0) setDashboard(d);
      } catch {
        /* fall back to illustrating */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
        setRepos((x) => x.map((r) => (r.id === id ? { ...r, status: "SYNCING", syncStatus: "SYNCING" } : r)));
        await new Promise((res) => setTimeout(res, 1200));
        setRepos((x) =>
          x.map((r) =>
            r.id === id
              ? { ...r, status: "CONNECTED", syncStatus: "SYNCED", lastSync: new Date().toISOString(), records: r.records + 24 }
              : r
          )
        );
        pushAudit("REPOSITORY_SYNCED", "REPOSITORY", id, `Synced repository, pulled 24 records`, "admin");
      },

      disconnectRepository: (id) => {
        setRepos((x) => x.map((r) => (r.id === id ? { ...r, status: "DISCONNECTED", health: "Offline" } : r)));
        pushAudit("REPOSITORY_DISCONNECTED", "REPOSITORY", id, "Repository disconnected", "admin");
      },

      importMaterials: (records, sourceDoc, note) => {
        const padded: SourceMaterial[] = records.map((r, i) => ({
          ...r,
          id: Date.now() + i,
          sourceDocument: sourceDoc || r.sourceDocument,
        }));
        setMaterials((m) => [...padded, ...m]);
        pushAudit("SOURCE_IMPORTED", "IMPORT_JOB", Date.now(), `${records.length} records imported from ${sourceDoc}${note ? " — " + note : ""}`, "admin");
      },

      runAiMatching: async () => {
        const stats = { processed: 12450, highConfidence: 9820, review: 1940, unmatched: 690 };
        setMatchingStats(stats);
        setLastMatchedAt(new Date().toISOString());
        await new Promise((r) => setTimeout(r, 600));
        pushAudit("MATCHING_RUN", "MATCHING_JOB", Date.now(), `${stats.highConfidence} high-confidence matches, ${stats.review} for review`, "ai-batch");
        return stats;
      },
      openReviewQueueFromMatch: () => {},

      approveMapping: (mappingId, reviewer, note) => {
        setMappings((x) =>
          x.map((m) => (m.id === mappingId ? { ...m, mappingStatus: "MAPPED", mappingSource: "AI + Reviewer", lastUpdated: new Date().toISOString(), createdBy: reviewer } : m))
        );
        pushAudit("MAPPING_APPROVED", "MAPPING", mappingId, note || "Mapping approved", reviewer);
      },
      rejectMapping: (mappingId, reviewer, note) => {
        setMappings((x) => x.map((m) => (m.id === mappingId ? { ...m, mappingStatus: "PENDING", lastUpdated: new Date().toISOString() } : m)));
        pushAudit("MAPPING_REJECTED", "MAPPING", mappingId, note || "Mapping rejected", reviewer);
      },
      changeMapping: (mappingId, newNmc, reviewer) => {
        setMappings((x) =>
          x.map((m) => (m.id === mappingId ? { ...m, nationalCode: newNmc, mappingStatus: "MAPPED", lastUpdated: new Date().toISOString(), createdBy: reviewer } : m))
        );
        pushAudit("MAPPING_CHANGED", "MAPPING", mappingId, `Mapping changed to ${newNmc}`, reviewer);
      },
      removeMapping: (mappingId) => {
        setMappings((x) => x.filter((m) => m.id !== mappingId));
        pushAudit("MAPPING_REMOVED", "MAPPING", mappingId, "Mapping removed", "system");
      },

      updateReviewStatus: (id, status, reviewer, note) => {
        const item = reviewItems.find((r) => r.id === id);
        setReviewItems((x) =>
          x.map((r) => (r.id === id ? { ...r, status, reviewedBy: reviewer, note } : r))
        );
        if (status === "APPROVED" && item) {
          setMappings((m) => {
            const existing = m.find((mp) => mp.sourceCode === item.codeA && mp.cpse === item.cpseA);
            if (existing) return m.map((mp) => (mp.id === existing.id ? { ...mp, mappingStatus: "MAPPED", lastUpdated: new Date().toISOString(), createdBy: reviewer, confidence: item.confidence } : mp));
            return [
              ...m,
              { id: Date.now(), cpse: item.cpseA, sourceCode: item.codeA, rawDescription: item.descA, normalizedDescription: item.descA, nationalCode: item.suggestedNmc, nationalDesc: item.suggestedDesc, mappingStatus: "MAPPED", confidence: item.confidence, mappingSource: "AI + Reviewer", lastUpdated: new Date().toISOString(), createdBy: reviewer, tenderDocName: `${item.cpseA} Tender`, tenderUrl: "", sourceCodeLabel: item.codeA },
            ];
          });
          pushAudit("MATCH_APPROVED", "MATCH_RECOMMENDATION", id, `Approved and linked to ${item.suggestedNmc}`, reviewer);
        } else if (status === "REJECTED") {
          pushAudit("MATCH_REJECTED", "MATCH_RECOMMENDATION", id, note || "Rejected", reviewer);
        }
      },

      bulkUpdateReviewStatus: (ids, status, reviewer) => {
        ids.forEach((id) => {
          const item = reviewItems.find((r) => r.id === id);
          setReviewItems((x) => x.map((r) => (r.id === id ? { ...r, status, reviewedBy: reviewer, note: status === "APPROVED" ? "Bulk approved" : status === "REJECTED" ? "Bulk rejected" : "Bulk" } : r)));
          if (status === "APPROVED" && item) {
            setMappings((m) => m.some((mp) => mp.sourceCode === item.codeA && mp.cpse === item.cpseA)
              ? m.map((mp) => (mp.sourceCode === item.codeA && mp.cpse === item.cpseA ? { ...mp, mappingStatus: "MAPPED", lastUpdated: new Date().toISOString(), createdBy: reviewer } : mp))
              : [...m, { id: Date.now(), cpse: item.cpseA, sourceCode: item.codeA, rawDescription: item.descA, normalizedDescription: item.descA, nationalCode: item.suggestedNmc, nationalDesc: item.suggestedDesc, mappingStatus: "MAPPED", confidence: item.confidence, mappingSource: "AI + Reviewer", lastUpdated: new Date().toISOString(), createdBy: reviewer, tenderDocName: `${item.cpseA} Tender`, tenderUrl: "", sourceCodeLabel: item.codeA }]);
          }
        });
        pushAudit("BULK_UPDATE", "MATCH_RECOMMENDATION", ids.length, `${ids.length} items marked ${status}`, reviewer);
      },

      mapMaterialToNmc: (materialId, nmc) => {
        setMaterials((x) => x.map((m) => (m.id === materialId ? { ...m, mappingStatus: "MAPPED", nmcCode: nmc } : m)));
        pushAudit("MAPPING_CREATED", "SOURCE_MATERIAL", materialId, `Mapped to ${nmc}`, "steward");
      },

      remediateDq: (id, patch) => {
        setDqRecords((x) => x.map((r) => (r.id === id ? { ...r, ...patch, status: "REMEDIATED", lastUpdated: new Date().toISOString(), remediationRequired: false } : r)));
        pushAudit("DATA_REMEDIATED", "DATA_QUALITY", id, "Record remediated", "steward");
      },
      sendDqToAi: (ids) => {
        const picked = dqRecords.filter((r) => ids.includes(r.id));
        const newItems: ReviewItem[] = picked.map((r, i) => ({
          id: Date.now() + i,
          cpseA: r.cpse, codeA: r.sourceCode, descA: r.rawDescription,
          cpseB: r.cpse, codeB: r.sourceCode + "-C", descB: "Candidate " + capStr(r.issueType) + " match",
          suggestedNmc: "NMC-UNLISTED", suggestedDesc: "Awaiting matching",
          confidence: 0.5, reason: "Remediated record re-submitted to AI matching from Data Quality.", status: "PENDING",
          priority: "MEDIUM", source: "Data Quality → AI", category: "GENERAL",
        }));
        setReviewItems((x) => [...newItems, ...x]);
        pushAudit("SENT_TO_MATCHING", "DATA_QUALITY", ids.length, `${ids.length} records sent to AI matching`, "steward");
      },
    };
  }, [loading, repos, materials, nmcCodes, mappings, reviewItems, dqRecords, auditEvents, procurement, matchingStats, dashboard, lastMatchedAt]);

  return <ProtoContext.Provider value={api_}>{children}</ProtoContext.Provider>;
}

export function useProto() {
  const ctx = useContext(ProtoContext);
  if (!ctx) throw new Error("useProto must be used within PrototypeDataProvider");
  return ctx;
}

export { capStr };
