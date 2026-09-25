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
  syncAllRepositories: () => Promise<void>;
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

export function migrateLegacyStorage() {
  if (typeof window === "undefined") return;
  try {
    const matStr = localStorage.getItem("nmm_materials");
    if (matStr && matStr.includes("NMC-0000")) {
      const mats = JSON.parse(matStr);
      if (Array.isArray(mats)) {
        const updated = mats.map((m: SourceMaterial) => ({
          ...m,
          nmcCode: normalizeNmcCode(m.nmcCode, m.normalizedDescription || m.originalDescription, m.category),
        }));
        localStorage.setItem("nmm_materials", JSON.stringify(updated));
      }
    }

    const mapStr = localStorage.getItem("nmm_mappings");
    if (mapStr && mapStr.includes("NMC-0000")) {
      const maps = JSON.parse(mapStr);
      if (Array.isArray(maps)) {
        const updated = maps.map((m: Mapping) => {
          const newCode = normalizeNmcCode(m.nationalCode, m.nationalDesc || m.normalizedDescription, "");
          return {
            ...m,
            nationalCode: newCode || m.nationalCode,
            nationalDesc: (newCode && nmcCodesById[newCode]) ? nmcCodesById[newCode] : m.nationalDesc,
          };
        });
        localStorage.setItem("nmm_mappings", JSON.stringify(updated));
      }
    }

    const revStr = localStorage.getItem("nmm_reviews");
    if (revStr && revStr.includes("NMC-0000")) {
      const revs = JSON.parse(revStr);
      if (Array.isArray(revs)) {
        const updated = revs.map((r: ReviewItem) => {
          const newCode = normalizeNmcCode(r.suggestedNmc, r.suggestedDesc, r.category);
          return {
            ...r,
            suggestedNmc: newCode || r.suggestedNmc,
            suggestedDesc: (newCode && nmcCodesById[newCode]) ? nmcCodesById[newCode] : r.suggestedDesc,
          };
        });
        localStorage.setItem("nmm_reviews", JSON.stringify(updated));
      }
    }
  } catch (e) {
    console.warn("Storage migration error", e);
  }
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
};

function pickNmc(desc: string): string | undefined {
  const keys = Object.keys(nmcHints).sort((a, b) => b.length - a.length);
  for (const k of keys) if (desc.toUpperCase().includes(k.toUpperCase())) return nmcHints[k];
  return undefined;
}

const DEMO_RECORDS: [string, string, string][] = [
  ["BALL BEARING 6205-2RS DEEP GROOVE SKF", "EA", "1"],
  ["GATE VALVE DN100 PN16 CLASS 150 FLANGED", "NOS", "4"],
  ["PVC INSULATED POWER CABLE 1.1KV 3C X 95 SQMM", "MTR", "500"],
  ["CENTRIFUGAL WATER PUMP 25 HP 3 PHASE", "NOS", "2"],
  ["NON ASBESTOS SPIRAL WOUND GASKET 4 INCH", "NOS", "12"],
  ["CARBON STEEL PIPE 4 INCH SCH 40 SEAMLESS", "MTR", "120"],
  ["HEX HEAD BOLT M16 X 70 WITH NUTS AND WASHERS", "SET", "200"],
  ["PRESSURE GAUGE 0-10 KG/CM2 DIAL 4 INCH", "NOS", "8"],
  ["WELDING ELECTRODE E7018 3.15MM X 350MM", "KG", "150"],
  ["CONVEYOR BELT 1200MM 5 PLY RUBBER", "MTR", "300"],
];

function seedMaterials(): SourceMaterial[] {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("nmm_materials");
    if (saved) {
      try {
        migrateLegacyStorage();
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: SourceMaterial) => ({
            ...m,
            nmcCode: normalizeNmcCode(m.nmcCode, m.normalizedDescription || m.originalDescription, m.category),
          }));
        }
      } catch {}
    }
  }

  const realGovRecords: SourceMaterial[] = [
    {
      id: 1,
      sourceOrganization: "COAL INDIA LIMITED",
      originalMaterialCode: "GEM/2026/B/8004695",
      originalDescription: "Hiring of Consultants - Milestone/Deliverable Based - Subscription to Cloud Infrastructure Services, Managed Services and CSP Consulting to enable Digital Transformation of Coal India Limited and its Subsidiary Companies",
      originalUom: "EA",
      originalQuantity: "1",
      normalizedDescription: "HIRING OF CONSULTANTS - MILESTONE/DELIVERABLE BASED - SUBSCRIPTION TO CLOUD INFRASTRUCTURE SERVICES",
      category: "GENERAL",
      lifecycle: "PENDING",
      mappingStatus: "UNMAPPED",
      aiConfidence: 75,
      dataQuality: "COMPLETE",
      sourceDocument: "Coal India NIT Notice GEM/2026/B/8004695",
      sourceUrl: "https://www.coalindia.in/tenders/",
      sourceRecordId: "GEM/2026/B/8004695",
    },
    {
      id: 2,
      sourceOrganization: "BHARAT HEAVY ELECTRICALS LIMITED (BHEL)",
      originalMaterialCode: "FSIP/EOI/STM/2023-24-001",
      originalDescription: "EoI for Development of Vendors for supply of Magnetic Steel Sheet Varnish to BHEL FSIP Jagdishpur, Amethi",
      originalUom: "EA",
      originalQuantity: "1",
      normalizedDescription: "EOI FOR DEVELOPMENT OF VENDORS FOR SUPPLY OF MAGNETIC STEEL SHEET VARNISH TO BHEL FSIP JAGDISHPUR",
      category: "RAW_MATERIAL",
      lifecycle: "PENDING",
      mappingStatus: "REVIEW",
      nmcCode: "NMC-STEEL-000020",
      aiConfidence: 85,
      dataQuality: "COMPLETE",
      sourceDocument: "BHEL Tender Notice FSIP/EOI/STM/2023-24-001",
      sourceUrl: "https://www.bhel.com/tenders",
      sourceRecordId: "FSIP/EOI/STM/2023-24-001",
    },
    {
      id: 3,
      sourceOrganization: "INDIAN OIL CORPORATION LIMITED (IOCL)",
      originalMaterialCode: "GEM/2026/B/7994627",
      originalDescription: "Sodium Hypochlorite Solution (V3) Conforming To Is 11673",
      originalUom: "EA",
      originalQuantity: "36000",
      normalizedDescription: "SODIUM HYPOCHLORITE SOLUTION (V3) CONFORMING TO IS 11673",
      category: "CHEMICALS",
      lifecycle: "ACTIVE",
      mappingStatus: "REVIEW",
      nmcCode: "NMC-CHEM-000014",
      aiConfidence: 92,
      dataQuality: "COMPLETE",
      sourceDocument: "GeM Bid Notice GEM/2026/B/7994627",
      sourceUrl: "https://bidplus.gem.gov.in/showbidDocument/9844712",
      sourceRecordId: "GEM/2026/B/7994627",
    },
    {
      id: 4,
      sourceOrganization: "Central Public Procurement / GeM",
      originalMaterialCode: "GEM/2026/B/8027429",
      originalDescription: "Miniature Circuit Breakers (MCB) for AC Operation Marked To IS/IEC 60898 (Part 1)",
      originalUom: "EA",
      originalQuantity: "500",
      normalizedDescription: "MINIATURE CIRCUIT BREAKERS (MCB) FOR AC OPERATION MARKED TO IS/IEC 60898 (PART 1)",
      category: "ELECTRICAL",
      lifecycle: "PENDING",
      mappingStatus: "REVIEW",
      nmcCode: "NMC-MCB-000013",
      aiConfidence: 94,
      dataQuality: "COMPLETE",
      sourceDocument: "GeM Bid Notice GEM/2026/B/8027429",
      sourceUrl: "https://bidplus.gem.gov.in/all-bids",
      sourceRecordId: "GEM/2026/B/8027429",
    },
    {
      id: 5,
      sourceOrganization: "COAL INDIA LIMITED",
      originalMaterialCode: "GEM/2026/B/7973222",
      originalDescription: "GAS DA 1, GAS OXYGEN 1, INDUSTRIAL GAS CYLINDERS",
      originalUom: "EA",
      originalQuantity: "28709",
      normalizedDescription: "GAS DA 1, GAS OXYGEN 1, INDUSTRIAL GAS CYLINDERS",
      category: "CHEMICALS",
      lifecycle: "PENDING",
      mappingStatus: "REVIEW",
      nmcCode: "NMC-GAS-000015",
      aiConfidence: 84,
      dataQuality: "COMPLETE",
      sourceDocument: "GeM Bid Notice GEM/2026/B/7973222",
      sourceUrl: "https://bidplus.gem.gov.in/all-bids",
      sourceRecordId: "GEM/2026/B/7973222",
    },
    {
      id: 6,
      sourceOrganization: "OIL AND NATURAL GAS CORPORATION (ONGC)",
      originalMaterialCode: "GEM/2026/B/7831709",
      originalDescription: "Hexamine (ONGC)",
      originalUom: "EA",
      originalQuantity: "8000",
      normalizedDescription: "HEXAMINE (ONGC)",
      category: "CHEMICALS",
      lifecycle: "PENDING",
      mappingStatus: "REVIEW",
      nmcCode: "NMC-CHEM-000016",
      aiConfidence: 86,
      dataQuality: "COMPLETE",
      sourceDocument: "GeM Bid Notice GEM/2026/B/7831709",
      sourceUrl: "https://bidplus.gem.gov.in/all-bids",
      sourceRecordId: "GEM/2026/B/7831709",
    },
  ];

  return realGovRecords;
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

function computeMappings(materials: SourceMaterial[]): Mapping[] {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("nmm_mappings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((m: Mapping) => {
            const code = normalizeNmcCode(m.nationalCode, m.nationalDesc || m.normalizedDescription, "");
            return {
              ...m,
              nationalCode: code || m.nationalCode,
              nationalDesc: (code && nmcCodesById[code]) ? nmcCodesById[code] : m.nationalDesc,
            };
          });
        }
      } catch {}
    }
  }

  return materials
    .filter((m) => m.nmcCode && m.mappingStatus !== "UNMAPPED")
    .map((m, idx) => {
      const code = normalizeNmcCode(m.nmcCode, m.normalizedDescription || m.originalDescription, m.category)!;
      return {
        id: idx + 1,
        cpse: m.sourceOrganization,
        sourceCode: m.originalMaterialCode,
        rawDescription: m.originalDescription,
        normalizedDescription: m.normalizedDescription || m.originalDescription.toUpperCase(),
        nationalCode: code,
        nationalDesc: nmcCodesById[code] || m.normalizedDescription || m.originalDescription,
        mappingStatus: m.mappingStatus,
        confidence: m.aiConfidence ? (m.aiConfidence > 1 ? m.aiConfidence / 100 : m.aiConfidence) : 0.85,
        mappingSource: "AI Multi-Layer Analysis",
        lastUpdated: new Date().toISOString(),
        createdBy: "steward",
        tenderDocName: m.sourceDocument || `${m.sourceOrganization} Official Tender`,
        tenderUrl: m.sourceUrl || "https://bidplus.gem.gov.in/all-bids",
        sourceCodeLabel: m.originalMaterialCode,
      };
    });
}

function computeDqRecords(materials: SourceMaterial[]): DqRecord[] {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("nmm_dq");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
  }

  const out: DqRecord[] = [];
  let id = 1;

  materials.forEach((m) => {
    const desc = (m.originalDescription || "").trim();
    const code = (m.originalMaterialCode || "").trim();
    const uom = (m.originalUom || "").trim();

    if (!code || code.length < 3) {
      out.push({
        id: id++,
        cpse: m.sourceOrganization,
        sourceCode: code || "UNKNOWN",
        rawDescription: desc || "Missing original description",
        extractedDescription: "Missing or incomplete source material code",
        dnaStatus: "INCOMPLETE",
        remediationRequired: true,
        issueType: "MISSING_SOURCE_CODE",
        severity: "ERROR",
        status: "OPEN",
        lastUpdated: new Date().toISOString(),
      });
    }

    if (!desc || desc.length < 5) {
      out.push({
        id: id++,
        cpse: m.sourceOrganization,
        sourceCode: code,
        rawDescription: desc,
        extractedDescription: "Missing description in source document",
        dnaStatus: "INCOMPLETE",
        remediationRequired: true,
        issueType: "MISSING_DESCRIPTION",
        severity: "ERROR",
        status: "OPEN",
        lastUpdated: new Date().toISOString(),
      });
    }

    if (!uom || uom === "—") {
      out.push({
        id: id++,
        cpse: m.sourceOrganization,
        sourceCode: code,
        rawDescription: desc,
        extractedDescription: "Missing standard Unit of Measure (UOM)",
        dnaStatus: "PARTIAL",
        remediationRequired: true,
        issueType: "INVALID_UOM",
        severity: "WARNING",
        status: "OPEN",
        lastUpdated: new Date().toISOString(),
      });
    }

    const hasGrade = /grade|class|is\s*\d+|astm|ss\s*304|ss\s*316|pn\s*\d+/i.test(desc);
    if (!hasGrade && (m.category === "FASTENER" || m.category === "VALVE" || m.category === "PIPING" || m.category === "CHEMICALS")) {
      out.push({
        id: id++,
        cpse: m.sourceOrganization,
        sourceCode: code,
        rawDescription: desc,
        extractedDescription: "Missing technical grade / material specification",
        dnaStatus: "PARTIAL",
        remediationRequired: true,
        issueType: "MISSING_GRADE",
        severity: "WARNING",
        status: "OPEN",
        lastUpdated: new Date().toISOString(),
      });
    }
  });

  return out;
}

function computeReviewItems(materials: SourceMaterial[], nmcs: NmcCode[]): ReviewItem[] {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("nmm_reviews");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
  }

  const out: ReviewItem[] = [];
  let id = 1;

  for (let i = 0; i < materials.length; i++) {
    for (let j = i + 1; j < materials.length; j++) {
      const a = materials[i];
      const b = materials[j];

      if (a.sourceOrganization !== b.sourceOrganization) {
        const wordsA = new Set(a.originalDescription.toUpperCase().split(/\W+/).filter((w) => w.length > 2));
        const wordsB = new Set(b.originalDescription.toUpperCase().split(/\W+/).filter((w) => w.length > 2));

        let common = 0;
        wordsA.forEach((w) => {
          if (wordsB.has(w)) common++;
        });
        const total = Math.max(wordsA.size, wordsB.size);
        const sim = total > 0 ? common / total : 0;

        if ((a.category === b.category && a.category !== "GENERAL") || sim >= 0.25) {
          const conf = Math.min(0.95, Math.max(0.65, Math.round((sim * 0.5 + 0.5) * 100) / 100));
          const rawSuggested =
            a.nmcCode ||
            b.nmcCode ||
            pickNmc(a.originalDescription) ||
            pickNmc(b.originalDescription) ||
            `${NATIONAL_CODE_PREFIX}-${getCategoryCode(a.category, a.originalDescription)}-000001`;
          const suggested = normalizeNmcCode(rawSuggested, a.originalDescription, a.category)!;
          const suggestedDesc = a.normalizedDescription || a.originalDescription;

          out.push({
            id: id++,
            cpseA: a.sourceOrganization,
            codeA: a.originalMaterialCode,
            descA: a.originalDescription,
            cpseB: b.sourceOrganization,
            codeB: b.originalMaterialCode,
            descB: b.originalDescription,
            suggestedNmc: suggested,
            suggestedDesc: suggestedDesc,
            confidence: conf,
            reason:
              a.category === b.category
                ? `Same physical category (${a.category}) with compatible functional specifications.`
                : `Lexical similarity detected across CPSE tenders; requires steward validation.`,
            status: "PENDING",
            priority: conf >= 0.85 ? "HIGH" : conf >= 0.7 ? "MEDIUM" : "LOW",
            source: "AI Multi-Layer Match",
            category: a.category,
          });
        }
      }
    }
  }

  return out;
}

function computeProcurement(materials: SourceMaterial[], mappings: Mapping[]): ProcurementInsight {
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

  const total = materials.length;
  const mapped = materials.filter((m) => m.nmcCode).length;
  const nmcCoverage = total > 0 ? Math.round((mapped / total) * 100) : 0;
  const unmappedPct = 100 - nmcCoverage;

  const topCats = categoryDistribution.slice(0, 4).map((c) => c.category);

  return {
    categoryDistribution,
    cpseVolume,
    nmcCoverage,
    unmappedPct,
    highValueCategories: topCats.length > 0 ? topCats : ["RAW_MATERIAL", "ELECTRICAL", "CHEMICALS", "VALVE"],
    standardizationOpps: Math.max(0, Math.floor(materials.length * 0.2)),
    duplicates: Math.max(0, Math.floor(materials.length * 0.15)),
    mappingCoverage: mappings.length > 0 ? Math.round((mappings.filter((m) => m.mappingStatus === "MAPPED").length / mappings.length) * 100) : 0,
    trend: [
      { label: "Jul", spend: Math.max(1, Math.round(total * 0.15)) },
      { label: "Aug", spend: Math.max(2, Math.round(total * 0.35)) },
      { label: "Sep", spend: Math.max(3, total) },
    ],
  };
}

function computeMatchingStats(materials: SourceMaterial[], reviewItems: ReviewItem[]): MatchingStats {
  const processed = materials.length;
  const highConf = materials.filter((m) => {
    const c = m.aiConfidence ?? 0;
    return c >= 80 || (c <= 1 && c >= 0.8);
  }).length;
  const review = reviewItems.filter((r) => r.status === "PENDING").length;
  const unmatched = materials.filter((m) => m.mappingStatus === "UNMAPPED").length;

  return {
    processed,
    highConfidence: highConf,
    review,
    unmatched,
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
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<Repo[]>(() => seedRepos());
  const [materials, setMaterials] = useState<SourceMaterial[]>(() => seedMaterials());
  const [nmcCodes, setNmcCodes] = useState<NmcCode[]>(() => seedNmcs());
  const [mappings, setMappings] = useState<Mapping[]>(() => computeMappings(seedMaterials()));
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(() => computeReviewItems(seedMaterials(), seedNmcs()));
  const [dqRecords, setDqRecords] = useState<DqRecord[]>(() => computeDqRecords(seedMaterials()));
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => seedAudit());
  const [procurement, setProcurement] = useState<ProcurementInsight>(() =>
    computeProcurement(seedMaterials(), computeMappings(seedMaterials()))
  );
  const [matchingStats, setMatchingStats] = useState<MatchingStats>(() =>
    computeMatchingStats(seedMaterials(), computeReviewItems(seedMaterials(), seedNmcs()))
  );
  const [lastMatchedAt, setLastMatchedAt] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);

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

  // Wire full dynamic reactivity: all downstream datasets derive purely from genuine materials
  useEffect(() => {
    const computedMaps = computeMappings(materials);
    const computedDq = computeDqRecords(materials);
    const computedReviews = computeReviewItems(materials, nmcCodes);
    const computedProc = computeProcurement(materials, computedMaps);
    const computedStats = computeMatchingStats(materials, computedReviews);

    setMappings(computedMaps);
    setDqRecords(computedDq);
    setReviewItems(computedReviews);
    setProcurement(computedProc);
    setMatchingStats(computedStats);

    // Synchronize repository record counts with actual materials in platform
    setRepos((prev) =>
      prev.map((r) => {
        const matchingCount = materials.filter((m) => {
          const org = m.sourceOrganization.toUpperCase();
          const rName = r.name.toUpperCase();
          if (org.includes(rName) || rName.includes(org)) return true;
          if (r.sourceKey && (m.sourceDocument.toLowerCase().includes(r.sourceKey) || org.toLowerCase().includes(r.sourceKey))) return true;
          return false;
        }).length;
        return {
          ...r,
          records: matchingCount,
        };
      })
    );
  }, [materials, nmcCodes]);

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
            const newRecords: SourceMaterial[] = liveData.records.map((rec: any, idx: number) => {
              const recId = Date.now() + idx;
              const nmc = pickNmc(rec.originalDescription);
              return {
                id: recId,
                sourceOrganization: rec.sourceOrganization || repo.name,
                originalMaterialCode: rec.originalMaterialCode || `REC-${recId}`,
                originalDescription: rec.originalDescription,
                originalUom: rec.originalUom || "EA",
                originalQuantity: String(rec.originalQuantity || "1"),
                normalizedDescription: rec.normalizedDescription || rec.originalDescription.toUpperCase(),
                category: rec.category || guessCat(rec.originalDescription),
                lifecycle: "PENDING",
                mappingStatus: nmc ? "REVIEW" : "UNMAPPED",
                nmcCode: nmc,
                aiConfidence: rec.dna?.confidence ? Math.round(rec.dna.confidence * 100) : 75,
                dataQuality: rec.dna?.specifications?.grade ? "COMPLETE" : "MISSING_GRADE",
                sourceDocument: rec.sourceDocument || `${repo.name} Live Tender Notice`,
                sourceUrl: rec.sourceUrl || repo.url,
                sourceRecordId: rec.sourceRecordId || rec.originalMaterialCode,
              };
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
              const updated = x.map((r) =>
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
            const updated = x.map((r) =>
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
        for (const r of repos) {
          if (r.status !== "DISCONNECTED") {
            try {
              await api_.syncRepository(r.id);
              await new Promise((res) => setTimeout(res, 800));
            } catch (e) {
              console.warn(`Error auto-syncing ${r.name}:`, e);
            }
          }
        }
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
        const newReviews = computeReviewItems(materials, nmcCodes);
        const stats = computeMatchingStats(materials, newReviews);
        setReviewItems(newReviews);
        setMatchingStats(stats);
        setLastMatchedAt(new Date().toISOString());
        try {
          localStorage.setItem("nmm_reviews", JSON.stringify(newReviews));
        } catch {}
        await new Promise((r) => setTimeout(r, 600));
        pushAudit(
          "MATCHING_RUN",
          "MATCHING_JOB",
          Date.now(),
          `AI multi-layer matching evaluated ${materials.length} records: ${stats.highConfidence} high-confidence, ${newReviews.length} queued for review`,
          "ai-matcher"
        );
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
          suggestedNmc: `${NATIONAL_CODE_PREFIX}-${getCategoryCode(r.issueType, r.rawDescription)}-000001`, suggestedDesc: "Awaiting matching",
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
