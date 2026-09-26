/**
 * Matching engine — TypeScript port of the existing Python implementation.
 *
 * Faithful mirror of:
 *   ai-service/app/analyzer.py  -> normalize_description, extract_dna (Material DNA)
 *   ai-service/app/matcher.py   -> fuzzy/semantic scores, attribute compare,
 *                                 conflict detection, confidence, classification
 *   backend MatchService.java   -> candidate floor (confidence < 0.4 dropped),
 *                                 conflict -> ESCALATED
 *
 * Nothing here invents a result: every score and attribute is derived from the
 * record text by the same rules the Python service uses, and a value that cannot
 * be extracted stays `null` (shown as "Not provided") rather than being guessed.
 */

/* ------------------------------------------------------------------ *
 * Decision policy — the thresholds the implementation actually uses.
 * ------------------------------------------------------------------ */

export const DECISION_POLICY = {
  /** backend MatchService.java:64 — candidates below this are never surfaced */
  candidateFloor: 0.4,
  /** matcher.py:101-107 — description-similarity bands */
  identicalDesc: 0.97,
  duplicateDesc: 0.9,
  duplicateAttrRatio: 0.8,
  nearDuplicateDesc: 0.75,
  functionallyEquivalentDesc: 0.6,
  functionallyEquivalentAttrRatio: 0.7,
  /** matcher.py:153 — a technical conflict caps confidence here */
  conflictConfidenceCap: 0.6,
  /** matcher.py:152 — and multiplies it down */
  conflictConfidenceFactor: 0.45,
  /** matcher.py:155 — final clamp */
  confidenceMin: 0,
  confidenceMax: 0.99,
} as const;

/** matcher.py:97-109 */
export type MatchClassification =
  | "IDENTICAL"
  | "DUPLICATE"
  | "NEAR_DUPLICATE"
  | "FUNCTIONALLY_EQUIVALENT"
  | "POTENTIAL_MATCH";

/* ------------------------------------------------------------------ *
 * Record-type classification (#3) — runs BEFORE material matching.
 * ------------------------------------------------------------------ */

export type RecordType = "MATERIAL" | "SERVICE" | "WORK" | "CONSULTANCY";

/**
 * Distinguishes procurement record types so services / works / consultancy are
 * never sent through material-to-material matching. Rules are deliberately
 * phrase-based (not single keywords) so that e.g. "Procurement of maintenance
 * EQUIPMENT" is still classified as a MATERIAL rather than a service.
 */
export function classifyRecordType(description: string): RecordType {
  // normalizeCase upper-cases, so every pattern must be case-insensitive.
  const d = normalizeCase(description);

  if (
    /\b(consultancy|consultant|consultants|consulting|advisory)\b/i.test(d) ||
    /\bhiring\s+of\s+consultant/i.test(d) ||
    /\b(feasibility\s+study|market\s+study|strategy|formulation\s+of)\b/i.test(d)
  ) {
    return "CONSULTANCY";
  }

  if (
    /\b(civil\s+works?|construction\s+works?|erection|renovation|repairing|repair\s+of)\b/i.test(d) ||
    /\bworks?\s+of\s+(construction|erection|renovation)\b/i.test(d) ||
    /\b(construction|erection)\s+of\b/i.test(d)
  ) {
    return "WORK";
  }

  if (
    /\b(providing\s+services?|supply\s+of\s+services?|services?\s+of\s+\w+)\b/i.test(d) ||
    /\b(annual\s+maintenance\s+contract|amc)\b/i.test(d) ||
    /\b(catering|housekeeping|transportation\s+services?|security\s+services?|manpower\s+services?)\b/i.test(d) ||
    /\b(services?\s+contract|service\s+of\s+(transportation|canteen|security|manpower))\b/i.test(d) ||
    /\b(subscription\s+to|managed\s+services?|cloud\s+infrastructure\s+services?)\b/i.test(d) ||
    /\b(supply\s+of\s+manpower|supply\s+of\s+labour|manpower\s+supply)\b/i.test(d)
  ) {
    return "SERVICE";
  }

  return "MATERIAL";
}

export const RECORD_TYPE_LABEL: Record<RecordType, string> = {
  MATERIAL: "MATERIAL",
  SERVICE: "SERVICE",
  WORK: "WORK",
  CONSULTANCY: "CONSULTANCY",
};

/** Only MATERIAL records are eligible for material-to-material matching. */
export function isMatchable(recordType: RecordType): boolean {
  return recordType === "MATERIAL";
}

/* ------------------------------------------------------------------ *
 * Material DNA — mirror of analyzer.py
 * ------------------------------------------------------------------ */

export interface Dna {
  category: string;
  type: string | null;
  material: string | null;
  grade: string | null;
  diameter: string | null;
  length: string | null;
  size: string | null;
  capacity: string | null;
  pressure_rating: string | null;
  voltage: string | null;
  uom: string | null;
}

const UOM_ALIASES: Record<string, string> = {
  EA: "EA", EACH: "EA", NOS: "NOS", NO: "NOS", NUMBER: "NOS",
  SET: "SET", KG: "KG", MT: "MT", M: "M", METER: "M", METRE: "M",
  MM: "MM", CM: "CM", L: "L", LTR: "L", LITRE: "L", LITERS: "L",
  TON: "TON", "SQ M": "SQ M", "CU M": "CU M", PAIR: "PAIR", ROLL: "ROLL",
  BOX: "BOX", PKT: "PKT", PCS: "PCS", KIT: "KIT", DRUM: "DRUM",
  BUNDLE: "BUNDLE", UNIT: "EA",
};

/** analyzer.py:19-26 */
const MATERIAL_MAP: Record<string, string> = {
  SS: "STAINLESS STEEL", "STAINLESS STEEL": "STAINLESS STEEL",
  MS: "MILD STEEL", "MILD STEEL": "MILD STEEL", "CARBON STEEL": "CARBON STEEL",
  CS: "CARBON STEEL", GI: "GALVANIZED IRON", CI: "CAST IRON",
  BRASS: "BRASS", BRONZE: "BRONZE", AL: "ALUMINIUM", ALUMINIUM: "ALUMINIUM",
  COPPER: "COPPER", PVC: "PVC", PTFE: "PTFE", TEFLON: "PTFE",
  NITRILE: "NITRILE", EPDM: "EPDM",
};

/** analyzer.py:28-29 */
function normalizeCase(s: string): string {
  return (s || "").toUpperCase().replace(/\//g, " ").replace(/\s+/g, " ").trim();
}

/** analyzer.py:220-229 */
export function normalizeDescription(description: string): string {
  if (!description) return "";
  let d = normalizeCase(description);
  for (const [token, full] of Object.entries(MATERIAL_MAP)) {
    if (token === full) continue;
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    d = d.replace(re, full);
  }
  // Separate digits from adjacent letters so "25MM" and "25 MM" are the same
  // specification rather than two different ones.
  d = d.replace(/(\d)\s*([A-Z]{2,})/g, "$1 $2").replace(/([A-Z]{2,})\s*(\d)/g, "$1 $2");
  return d.replace(/\s+/g, " ").trim();
}

/**
 * Tokenize for similarity. Punctuation is dropped so that "PUMP," and "PUMP"
 * are the same token — a bare character-level ratio otherwise penalises or
 * inflates purely because of commas and hyphens.
 */
function tokenize(s: string): string[] {
  return normalizeDescription(s)
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter(Boolean);
}

function fmtNum(s: string): string {
  const n = parseFloat(s);
  if (!isFinite(n)) return s;
  return String(Number(n.toFixed(4)));
}

function firstMatch(d: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = d.match(re);
    if (m) return m[0].toUpperCase();
  }
  return null;
}

/** analyzer.py:39-43 */
function findUnit(desc: string): string | null {
  const m = desc.match(
    /\b(EA|EACH|NOS?|SET|KG|MT|METRE|METER|M|MM|CM|SQ\s?M|CU\s?M|PAIR|ROLL|LTR|LITRE|TON|BOX|PKT|PCS|KIT|DRUM|BUNDLE)\b/,
  );
  return m ? UOM_ALIASES[m[1].toUpperCase()] ?? m[1].toUpperCase() : null;
}

/** analyzer.py:45-56 */
function extractDiameter(desc: string): string | null {
  const d2 = desc.match(/(?:DIA|DIAMETER|DIAM|Ø)[\s:]*(\d{1,4}(?:\.\d+)?)\s*(MM)?/);
  if (d2) return `${fmtNum(d2[1])} ${d2[2] ?? "MM"}`;
  const d3 = desc.match(/(?:DN|NB)\s*(\d{1,4})/);
  if (d3) return `${fmtNum(d3[1])} MM`;
  const d4 = desc.match(/M(\d{1,3})(?:X|\s*[xX]\s*)/);
  if (d4) return `${fmtNum(d4[1])} MM`;
  return null;
}

/** analyzer.py:59-65 */
function extractLength(desc: string): string | null {
  const d2 = desc.match(/(?:X)\s*(\d{1,4}(?:\.\d+)?)\s*(MM|CM|M)?/);
  if (d2) return `${fmtNum(d2[1])} ${d2[2] ?? "MM"}`;
  return null;
}

/** analyzer.py:67-89 */
function extractGrade(desc: string): string | null {
  return firstMatch(desc, [
    /\b(SS304|304L|SS316|316L|SS410|SS202|SS430)\b/,
    /\b(IS2062|IS2062\s?E250|E250|E350|IS1239|IS3589|IS800)\b/,
    /\b(ASTM\s?A106\s?Gr\.?\s?B|A106\s?Gr\.?B|A53\s?Gr\.?B)\b/,
    /\bGRADE\s?\s?\d+/,
    /\bPN\s?\d+/,
    /\b(SCH)\s?(20|40|80|160|XXS|XS|STD)\b/,
  ]);
}

/** analyzer.py:82-89 */
function extractPressure(desc: string): string | null {
  const m = desc.match(/(?:PN|PRESSURE|CLASS)[\s:]*(\d{1,4})/);
  if (m) return `PN ${m[1]}`;
  const m2 = desc.match(/\b(CLASS|CL)\s?(150|300|600|900|1500|2500)\b/);
  if (m2) return `CLASS ${m2[2]}`;
  return null;
}

/**
 * analyzer.py:91-93 declares `_extract_size` but returned None ("size handled
 * per category below"). Completed here (and in analyzer.py) so a real size such
 * as "25 MM" is extracted as evidence instead of being reported as missing.
 */
function extractSize(desc: string): string | null {
  const explicit = desc.match(/(?:SIZE|SIZ)[\s:]*(\d{1,4}(?:\.\d+)?)\s*(MM|CM|IN|INCH)?/);
  if (explicit) return `${fmtNum(explicit[1])} ${explicit[2] ?? "MM"}`;
  const bare = desc.match(/\b(\d{1,4}(?:\.\d+)?)\s?(MM|CM|IN|INCH)\b/);
  if (bare) return `${fmtNum(bare[1])} ${bare[2]}`;
  return null;
}

/** Power rating, e.g. "10 HP" / "7.5 KW" — used by pumps, motors, blowers. */
function extractPowerCapacity(desc: string): string | null {
  const m = desc.match(/\b(\d{1,4}(?:\.\d+)?)\s?(HP|KW)\b/);
  return m ? `${fmtNum(m[1])} ${m[2].toUpperCase()}` : null;
}

/** analyzer.py:95-129 */
function matchCategory(desc: string): string {
  const d = desc.toUpperCase();
  const rules: Array<[string, RegExp]> = [
    ["FASTENER", /\b(BOLT|SCREW|NUT|WASHER|STUD|FASTENER)\b/],
    ["VALVE", /\b(VALVE|GATE|GLOBE|BALL|BUTTERFLY|CHECK|NON-RETURN)\b/],
    ["PUMP", /\b(PUMP)\b/],
    ["BEARING", /\b(BEARING)\b/],
    ["MOTOR", /\b(MOTOR)\b/],
    ["ELECTRICAL", /\b(CABLE|WIRE|CONDUCTOR|TRANSFORMER)\b/],
    ["GASKET", /\b(GASKET)\b/],
    ["FLANGE", /\b(FLANGE)\b/],
    ["PIPE", /\b(PIPE|TUBE|TUBING)\b/],
    ["STEEL", /\b(STEEL|PLATE|SHEET|BAR|ANGLE|CHANNEL|BEAM|WIRE\s?ROD)\b/],
    ["COMPRESSOR", /\b(COMPRESSOR)\b/],
    ["HOSE", /\b(HOSE)\b/],
    ["FILTER", /\b(FILTER)\b/],
    ["ELECTRICAL", /\b(SWITCH|BREAKER|CONTACTOR|RELAY)\b/],
    ["LUBRICANT", /\b(OIL|LUBRICANT|GREASE)\b/],
  ];
  for (const [cat, re] of rules) if (re.test(d)) return cat;
  return "GENERAL";
}

/** analyzer.py:131-153 */
function fastenerAttrs(d: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const m = d.match(/M(\d{1,3})\s*(?:[Xx]|\*)/);
  if (m) out.grid_diameter = `${m[1]} MM`;
  const head = d.match(/\b(HEX|SOCKET|CARRIAGE|EYE|HOOK|ANCHOR|FLANGE)\s*HEAD\b/);
  if (head) out.head_type = `${titleCase(head[1])} Head`;
  for (const [word, type] of [
    ["HEX", "HEX BOLT"], ["STUD", "STUD"], ["NUT", "NUT"],
    ["WASHER", "WASHER"], ["SCREW", "SCREW"], ["BOLT", "BOLT"],
  ] as const) {
    if (new RegExp(`\\b${word}\\b`).test(d)) { out.type = type; break; }
  }
  return out;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** analyzer.py:155-218 — Material DNA. Missing values stay null (never invented). */
export function extractDna(description: string): Dna {
  const desc = normalizeCase(description);
  const dna: Dna = {
    category: matchCategory(description),
    type: null,
    material: null,
    grade: null,
    diameter: null,
    length: null,
    size: null,
    capacity: null,
    pressure_rating: null,
    voltage: null,
    uom: findUnit(desc),
  };

  for (const token of Object.keys(MATERIAL_MAP).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (re.test(desc)) { dna.material = MATERIAL_MAP[token]; break; }
  }

  dna.grade = extractGrade(desc);
  dna.diameter = extractDiameter(desc);
  dna.length = extractLength(desc);
  dna.size = extractSize(desc);

  switch (dna.category) {
    case "FASTENER": {
      const fa = fastenerAttrs(desc);
      dna.type = fa.type ?? null;
      if (!dna.diameter) dna.diameter = fa.grid_diameter ?? null;
      break;
    }
    case "VALVE": {
      const t = desc.match(/\b(GATE|GLOBE|BALL|BUTTERFLY|CHECK|NON-RETURN)\b/);
      if (t) dna.type = `${titleCase(t[1])} Valve`;
      dna.pressure_rating = extractPressure(desc);
      if (!dna.diameter) {
        const m = desc.match(/(?:DN|NB)\s*(\d{1,4})/);
        if (m) dna.diameter = `${m[1]} MM`;
      }
      break;
    }
    case "PIPE": {
      dna.pressure_rating = extractPressure(desc);
      const m = desc.match(/\b(SEAMLESS|ERW|EFW|HDPE|PVC)\b/);
      if (m) dna.type = m[1].toUpperCase();
      break;
    }
    case "GASKET": {
      const m = desc.match(/\b(SPIRAL WOUND|CAF|METALLIC|NON-ASBESTOS|FULL FACE)\b/);
      if (m) dna.type = titleCase(m[1]);
      break;
    }
    case "ELECTRICAL": {
      const kv = desc.match(/(\d+(?:\.\d+)?)\s*KV/);
      if (kv) dna.voltage = `${kv[1]} KV`;
      const sq = desc.match(/(\d+(?:\.\d+)?)\s*(?:SQ\s?MM|SQMM)/);
      if (sq) dna.capacity = `${sq[1]} SQ MM`;
      break;
    }
  }

  if (!dna.capacity) dna.capacity = extractPowerCapacity(desc);
  if (!dna.diameter && dna.size) dna.diameter = dna.size;
  if (!dna.size && dna.diameter) dna.size = dna.diameter;

  return dna;
}

/* ------------------------------------------------------------------ *
 * Similarity — matcher.py:24-49
 * ------------------------------------------------------------------ */

/**
 * Indel (Levenshtein-without-substitution) distance, which is what
 * rapidfuzz's `fuzz.ratio` / `token_sort_ratio` / `token_set_ratio` use:
 * a substitution costs 2, an insertion or deletion costs 1.
 */
export function indelDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 2;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** rapidfuzz `fuzz.ratio`, normalized to 0..1. */
function ratio(a: string, b: string): number {
  const total = a.length + b.length;
  if (total === 0) return 1;
  return (total - indelDistance(a, b)) / total;
}

/** Token-sort ratio: compare the sorted token sequences. */
function tokenSortRatio(a: string, b: string): number {
  const sa = tokenize(a).sort().join(" ");
  const sb = tokenize(b).sort().join(" ");
  return ratio(sa, sb);
}

/**
 * Token-set ratio — the standard fuzzywuzzy/rapidfuzz definition:
 * compare (a ∩ b) against (a ∩ b + b\a) and (a ∩ b + a\b), and the two
 * differences against each other.
 *
 * A comparison is skipped when the corresponding difference set is empty:
 * otherwise a subset would be compared against itself and score a meaningless
 * 100% (e.g. "BALL VALVE 25 MM" vs "STAINLESS STEEL BALL VALVE 25 MM").
 */
function tokenSetRatio(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  const inter = [...ta].filter((t) => tb.has(t)).sort();
  const restA = [...ta].filter((t) => !tb.has(t)).sort();
  const restB = [...tb].filter((t) => !ta.has(t)).sort();
  if (!inter.length) return 0;
  const sect = inter.join(" ");
  const c1 = [sect, ...restA].filter(Boolean).join(" ");
  const c2 = [sect, ...restB].filter(Boolean).join(" ");
  let best = 0;
  if (restA.length) best = Math.max(best, ratio(sect, c1));
  if (restB.length) best = Math.max(best, ratio(sect, c2));
  if (restA.length && restB.length) best = Math.max(best, ratio(c1, c2));
  return best;
}

/** matcher.py:24-33 — max of the three fuzzy ratios. */
export function fuzzyScore(descA: string, descB: string): number {
  const a = normalizeDescription(descA);
  const b = normalizeDescription(descB);
  if (!a || !b) return 0;
  return Math.max(ratio(a, b), tokenSortRatio(a, b), tokenSetRatio(a, b));
}

/**
 * matcher.py:44-49 — token-overlap semantic fallback.
 * Mirrors `_token_semantic`, which tokenizes the RAW description (no
 * abbreviation expansion), so the score matches the service.
 * Note: matcher.py prefers sentence-transformer embeddings when the model is
 * installed; the service falls back to this same token overlap when it is not,
 * so this is the fallback the prototype actually exercises.
 */
export function tokenSemantic(descA: string, descB: string): number {
  const ra = (descA || "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const rb = (descB || "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const na = new Set(ra);
  const nb = new Set(rb);
  if (!na.size || !nb.size) return 0;
  let inter = 0;
  na.forEach((t) => { if (nb.has(t)) inter++; });
  const union = new Set([...na, ...nb]).size;
  return inter / Math.max(1, union);
}

/* ------------------------------------------------------------------ *
 * Attribute comparison + conflict detection — matcher.py:60-95
 * ------------------------------------------------------------------ */

/** matcher.py:60-61 */
export const ATTRIBUTE_KEYS = [
  "material", "grade", "diameter", "length", "size",
  "pressure_rating", "voltage", "capacity", "type", "standard",
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type AttributeStatus = "SAME" | "DIFF" | "MISSING";

export interface AttributeResult {
  attribute: AttributeKey;
  label: string;
  sourceA: string | null;
  sourceB: string | null;
  status: AttributeStatus;
}

export interface Conflict {
  attribute: AttributeKey;
  label: string;
  source: string | null;
  candidate: string | null;
  note: string;
}

export const ATTRIBUTE_LABEL: Record<AttributeKey, string> = {
  material: "Material",
  grade: "Material Grade",
  diameter: "Size / Diameter",
  length: "Length",
  size: "Size",
  pressure_rating: "Pressure Rating",
  voltage: "Voltage",
  capacity: "Capacity",
  type: "Item Type",
  standard: "Standard",
};

function normVal(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase();
  return s === "" || s === "NONE" || s === "NOT PROVIDED" ? null : s;
}

/** matcher.py:63-81 */
export function compareAttributes(dnaA: Dna, dnaB: Dna): AttributeResult[] {
  return ATTRIBUTE_KEYS.map((key) => {
    const va = normVal((dnaA as unknown as Record<string, unknown>)[key]);
    const vb = normVal((dnaB as unknown as Record<string, unknown>)[key]);
    const status: AttributeStatus = va === null && vb === null ? "MISSING" : va === null ? "MISSING" : vb === null ? "MISSING" : va === vb ? "SAME" : "DIFF";
    return { attribute: key, label: ATTRIBUTE_LABEL[key], sourceA: va, sourceB: vb, status };
  });
}

/** matcher.py:83-95 — any DIFF is a blocking technical conflict. */
export function detectConflicts(attrs: AttributeResult[]): Conflict[] {
  return attrs
    .filter((a) => a.status === "DIFF")
    .map((a) => ({
      attribute: a.attribute,
      label: a.label,
      source: a.sourceA,
      candidate: a.sourceB,
      note: "A differing technical specification prevents automatic combination.",
    }));
}

/* ------------------------------------------------------------------ *
 * Classification + confidence — matcher.py:97-155
 * ------------------------------------------------------------------ */

/** matcher.py:97-109 */
export function classify(
  descSim: number,
  attrSame: number,
  attrTotal: number,
  hasConflict: boolean,
): MatchClassification {
  if (hasConflict) return "POTENTIAL_MATCH";
  const matchRatio = attrSame / Math.max(1, attrTotal);
  if (descSim >= DECISION_POLICY.identicalDesc) return "IDENTICAL";
  if (descSim >= DECISION_POLICY.duplicateDesc && matchRatio >= DECISION_POLICY.duplicateAttrRatio) return "DUPLICATE";
  if (descSim >= DECISION_POLICY.nearDuplicateDesc) return "NEAR_DUPLICATE";
  if (matchRatio >= DECISION_POLICY.functionallyEquivalentAttrRatio || descSim >= DECISION_POLICY.functionallyEquivalentDesc) {
    return "FUNCTIONALLY_EQUIVALENT";
  }
  return "POTENTIAL_MATCH";
}

export interface MatchEvidence {
  /** description-level agreement, matcher.py:124 */
  descriptionSimilarity: number;
  /** token-overlap meaning signal, matcher.py:44-49 */
  meaningSimilarity: number;
  /** fuzzy-only figure shown separately for transparency, matcher.py:24-33 */
  fuzzySimilarity: number;
  attributes: AttributeResult[];
  attributesSame: number;
  attributesDiff: number;
  attributesMissing: number;
  attributesTotal: number;
  attributeMatchRatio: number;
  categoryCompatible: boolean;
  unitCompatible: boolean;
  categorySourceA: string;
  categorySourceB: string;
  unitSourceA: string | null;
  unitSourceB: string | null;
  /** the single uncertain/critical attribute that blocks automation */
  primaryBlocker: string | null;
  blockers: string[];
  conflicts: Conflict[];
  hasConflict: boolean;
  uncertainty: number;
  baseConfidence: number;
  confidence: number;
  classification: MatchClassification;
  recommendation: MatchRecommendation;
  reasons: string[];
}

export type MatchRecommendation =
  | "RECOMMEND_APPROVAL"
  | "HUMAN_REVIEW"
  | "AUTO_MERGE_BLOCKED"
  | "BELOW_CANDIDATE_FLOOR";

/** matcher.py:161-176 */
function buildReasons(attrs: AttributeResult[], fuzzy: number, hasConflict: boolean, notes: string[]): string[] {
  const reasons: string[] = [];
  const by = (k: AttributeKey) => attrs.find((a) => a.attribute === k);
  if (by("material")?.status === "SAME") reasons.push("Same material");
  if (by("grade")?.status === "SAME") reasons.push("Same grade");
  if (by("diameter")?.status === "SAME") reasons.push("Same size/diameter");
  if (by("length")?.status === "SAME") reasons.push("Same length");
  if (fuzzy >= 0.7) reasons.push("Similar description");
  const anyDiff = attrs.some((a) => a.status === "DIFF");
  if (!hasConflict && !anyDiff) reasons.push("No conflicting technical details");
  if (hasConflict) reasons.push("Technical difference found");
  reasons.push(...notes);
  return reasons;
}

function describeBlocker(c: Conflict): string {
  return `${c.label} differs: ${c.source ?? "not provided"} vs ${c.candidate ?? "not provided"}`;
}

/** matcher.py:111-208 — the full comparison. */
export function compareRecords(
  descA: string,
  dnaA: Dna,
  descB: string,
  dnaB: Dna,
  unitA?: string | null,
  unitB?: string | null,
): MatchEvidence {
  const fuzzy = fuzzyScore(descA, descB);
  const semantic = tokenSemantic(descA, descB);

  const attrs = compareAttributes(dnaA, dnaB);
  const attributesSame = attrs.filter((a) => a.status === "SAME").length;
  const attributesDiff = attrs.filter((a) => a.status === "DIFF").length;
  const attributesMissing = attrs.filter((a) => a.status === "MISSING").length;
  const attributesTotal = attrs.length;

  const conflicts = detectConflicts(attrs);
  const hasConflict = conflicts.length > 0;

  const descAgreement = 0.7 * fuzzy + 0.3 * semantic;
  const present = attributesTotal - attributesMissing;
  const techAgreement = attributesSame / Math.max(1, present);
  const baseConfidence = 0.55 * descAgreement + 0.45 * techAgreement;

  // matcher.py:137-147 — honest uncertainty for missing critical attributes
  let uncertainty = 0;
  const notes: string[] = [];
  if (!dnaA.grade || !dnaB.grade) {
    uncertainty += 0.06;
    notes.push("Grade is missing on one or both records; this adds uncertainty to the assessment.");
  }
  if (!dnaA.diameter || !dnaB.diameter) uncertainty += 0.03;
  const catA = (dnaA.category || "").toUpperCase();
  const catB = (dnaB.category || "").toUpperCase();
  if (catA && catB && catA !== catB) {
    uncertainty += 0.05;
    notes.push("The material categories differ; this adds substantial uncertainty.");
  }

  let confidence = baseConfidence - uncertainty;

  // matcher.py:151-153 — a technical conflict blocks automatic combination
  if (hasConflict) {
    confidence = Math.min(confidence * DECISION_POLICY.conflictConfidenceFactor, DECISION_POLICY.conflictConfidenceCap);
  }
  confidence = Math.max(DECISION_POLICY.confidenceMin, Math.min(DECISION_POLICY.confidenceMax, confidence));

  const classification = classify(descAgreement, attributesSame, attributesTotal, hasConflict);

  const categoryCompatible = catA === catB;
  const uA = unitA ?? dnaA.uom ?? null;
  const uB = unitB ?? dnaB.uom ?? null;
  const unitCompatible = uA !== null && uB !== null && uA === uB;

  // Why it is not auto-merged — only reasons actually supported by the comparison
  const blockers: string[] = [];
  if (hasConflict) conflicts.forEach((c) => blockers.push(describeBlocker(c)));
  if (!dnaA.grade || !dnaB.grade) blockers.push("Material grade missing on one or both records");
  if (!dnaA.diameter || !dnaB.diameter) blockers.push("Size / diameter missing on one or both records");
  if (!categoryCompatible) blockers.push(`Category differs: ${catA || "—"} vs ${catB || "—"}`);
  if (attributesMissing > 0 && attributesSame === 0) blockers.push("No comparable technical attributes present");
  if (uA && uB && !unitCompatible) blockers.push(`Unit differs: ${uA} vs ${uB}`);

  let recommendation: MatchRecommendation;
  if (hasConflict) recommendation = "AUTO_MERGE_BLOCKED";
  else if (confidence < DECISION_POLICY.candidateFloor) recommendation = "BELOW_CANDIDATE_FLOOR";
  else if (confidence >= DECISION_POLICY.duplicateDesc) recommendation = "RECOMMEND_APPROVAL";
  else recommendation = "HUMAN_REVIEW";

  return {
    descriptionSimilarity: round3(descAgreement),
    meaningSimilarity: round3(semantic),
    fuzzySimilarity: round3(fuzzy),
    attributes: attrs,
    attributesSame,
    attributesDiff,
    attributesMissing,
    attributesTotal,
    attributeMatchRatio: round3(techAgreement),
    categoryCompatible,
    unitCompatible,
    categorySourceA: dnaA.category,
    categorySourceB: dnaB.category,
    unitSourceA: uA,
    unitSourceB: uB,
    primaryBlocker: blockers[0] ?? null,
    blockers,
    conflicts,
    hasConflict,
    uncertainty: round3(uncertainty),
    baseConfidence: round3(baseConfidence),
    confidence: round3(confidence),
    classification,
    recommendation,
    reasons: buildReasons(attrs, fuzzy, hasConflict, notes),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export const RECOMMENDATION_LABEL: Record<MatchRecommendation, string> = {
  RECOMMEND_APPROVAL: "Recommended for human approval",
  HUMAN_REVIEW: "Human review required",
  AUTO_MERGE_BLOCKED: "Auto-merge blocked",
  BELOW_CANDIDATE_FLOOR: "Below candidate floor — not surfaced",
};

export const CLASSIFICATION_LABEL: Record<MatchClassification, string> = {
  IDENTICAL: "Identical",
  DUPLICATE: "Duplicate",
  NEAR_DUPLICATE: "Near duplicate",
  FUNCTIONALLY_EQUIVALENT: "Functionally equivalent",
  POTENTIAL_MATCH: "Potential match",
};
