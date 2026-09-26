/**
 * Invariant checks for the derivation pipeline.
 *
 * These assert the properties the platform actually promises — that nothing is
 * fabricated, that non-materials never match, that a national code only exists
 * because a human decided it, and that a technical conflict can never be
 * merged. They run the real exported functions, not reimplementations.
 *
 *   npx tsx scripts/verify.ts
 */

// Minimal browser globals so the storage/migration path runs outside a browser.
const store = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

const {
  seedFixtureMaterials,
  computeReviewItems,
  computeMappings,
  computeDqRecords,
  canApproveCandidate,
  pairKey,
  enrichRecord,
  migrateStorage,
} = await import("../src/context/prototype-data.tsx");
const { extractDna, classifyRecordType, DECISION_POLICY } = await import("../src/lib/matching.ts");

let failures = 0;
let checks = 0;

function ok(cond: boolean, label: string, detail = "") {
  checks++;
  if (cond) {
    console.log(`  pass  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ""}`);
  }
}
function near(actual: number, expected: number, tol: number) {
  return Math.abs(actual - expected) <= tol;
}
function section(name: string) {
  console.log(`\n${name}`);
}

const materials = seedFixtureMaterials();
const nmcs = [
  { nationalCode: "NMC-VALVE-000005", description: "BALL VALVE 2 INCH SS304 PN16", category: "VALVE", status: "APPROVED" },
  { nationalCode: "NMC-VALVE-000021", description: "BALL VALVE STAINLESS STEEL SS304 DN25", category: "VALVE", status: "APPROVED" },
  { nationalCode: "NMC-VALVE-000022", description: "BALL VALVE STAINLESS STEEL SS316 DN25", category: "VALVE", status: "APPROVED" },
  { nationalCode: "NMC-PUMP-000004", description: "CENTRIFUGAL WATER PUMP 5 HP FLANGE MOUNTED", category: "PUMP", status: "APPROVED" },
  { nationalCode: "NMC-PUMP-000023", description: "CENTRIFUGAL PUMP 10 HP", category: "PUMP", status: "APPROVED" },
];

// ---------------------------------------------------------------- provenance
section("Provenance and record classification");
ok(materials.length === 14, "seed dataset has 14 records (8 demo + 6 reference)", `got ${materials.length}`);
ok(
  materials.filter((m: any) => m.origin === "DEMO").length === 8,
  "exactly 8 records are marked DEMO",
);
ok(
  materials.every((m: any) => ["LIVE", "REFERENCE", "DEMO"].includes(m.origin)),
  "every record carries a valid provenance value",
);
ok(
  materials.every((m: any) => typeof m.itemLevel === "boolean"),
  "every record declares its granularity",
);
ok(
  materials.every((m: any) => m.aiConfidence === null),
  "no record carries a pre-baked AI score before matching runs",
);
ok(
  materials.every((m: any) => m.nmcCode === undefined),
  "no record starts life mapped to a national code",
);
ok(
  materials.filter((m: any) => m.recordType === "SERVICE").length >= 1 &&
    materials.filter((m: any) => m.recordType === "WORK").length >= 1,
  "the dataset contains service and work records to be excluded",
);
ok(
  extractDna("BALL VALVE, SS304, 25 MM").grade === "SS304",
  "extractor recovers the grade",
);
ok(
  extractDna("CENTRIFUGAL PUMP 10 HP").capacity === "10 HP",
  "extractor recovers the pump rating",
);
ok(
  classifyRecordType("Security services for campus") === "SERVICE",
  "plural service wording is not mistaken for a material",
);

// ------------------------------------------------------------------ matching
section("Matching engine");
const { items, evaluated, rejected } = computeReviewItems(materials, nmcs, []);
ok(evaluated > 0, "candidates were evaluated", `evaluated=${evaluated}`);
ok(rejected > 0, "sub-floor pairs are rejected, not queued", `rejected=${rejected}`);

const up = (v: string) => v.toUpperCase();
const ss304 = items.find((i: any) => up(i.cpseA).includes("COAL INDIA") && up(i.cpseB).includes("BHEL"));
ok(!!ss304, "case 1: SS304 valve pair is surfaced");
ok(
  !!ss304 && near(ss304.confidence, 0.827, 0.01) && ss304.classification === "FUNCTIONALLY_EQUIVALENT",
  "case 1: scores 0.827 and is functionally equivalent",
  ss304 ? `got ${ss304.confidence.toFixed(3)} ${ss304.classification}` : "pair missing",
);
ok(!!ss304 && ss304.suggestedNmc === "NMC-VALVE-000021", "case 1: suggests the 25 mm SS304 code, not the 2-inch one",
  ss304 ? `got ${ss304.suggestedNmc}` : "");

const pumps = items.find((i: any) => up(i.cpseA).includes("NTPC") && up(i.cpseB).includes("INDIAN OIL"));
ok(!!pumps && near(pumps.confidence, 0.763, 0.01), "case 2: pump pair scores 0.763",
  pumps ? `got ${pumps.confidence.toFixed(3)}` : "pair missing");
ok(!!pumps && pumps.evidence!.blockers.length > 0, "case 2: missing attributes are reported as blockers");

// The blocked pair is the cross-grade one: an SS304 record against an SS316
// record. 101/102 are both SS304 and 105/106 are both SS316, so the same-grade
// pairs must NOT be flagged.
const conflict = items.find(
  (i: any) => [i.codeA, i.codeB].includes("DEMO-CIL-VLV-001") && [i.codeA, i.codeB].includes("DEMO-BPCL-VLV-002"),
);
const sameGradePair = items.find(
  (i: any) => [i.codeA, i.codeB].includes("DEMO-BPCL-VLV-002") && [i.codeA, i.codeB].includes("DEMO-ONGC-VLV-019"),
);
ok(!!sameGradePair && sameGradePair.autoMergeBlocked === false, "same-grade SS316 pair is not blocked");
ok(!!conflict, "case 3: SS304 vs SS316 conflict is surfaced even below the floor");
ok(!!conflict && conflict.autoMergeBlocked, "case 3: flagged as auto-merge blocked");
ok(!!conflict && conflict.evidence!.hasConflict, "case 3: engine reports a real attribute conflict");
ok(
  !!conflict && conflict.suggestedNmc === "NMC-VALVE-000021",
  "case 3: suggestion is deterministic, not invented per pair",
  conflict ? `got ${conflict.suggestedNmc}` : "",
);

ok(
  items.every((i: any) => i.materialIdA !== undefined && i.materialIdB !== undefined),
  "every candidate carries resolvable record ids for provenance",
);
ok(
  items.every((i: any) => i.confidence >= DECISION_POLICY.candidateFloor || i.evidence!.hasConflict),
  "no candidate is queued below the floor unless it has a conflict",
);
ok(
  items.every((i: any) => i.suggestedNmc && i.suggestedNmc.startsWith("NMC-")),
  "every candidate carries a well-formed national code",
);

// Non-material records must never reach the queue.
const nonMaterialIds = new Set(
  materials.filter((m: any) => m.recordType !== "MATERIAL").map((m: any) => m.id),
);
ok(
  items.every((i: any) => !nonMaterialIds.has(i.materialIdA) && !nonMaterialIds.has(i.materialIdB)),
  "no service, work or consultancy record appears in any candidate",
);

// ------------------------------------------------------------- approval rule
section("The conflict rule cannot be bypassed");
const blockedItem = conflict;
ok(!!blockedItem && canApproveCandidate(blockedItem).ok === false, "conflicting pair is not approvable");
const refusal = blockedItem ? (canApproveCandidate(blockedItem) as { ok: false; reason: string }).reason : "";
ok(refusal.includes("Cannot merge"), "refusal explains itself", refusal);
ok(/grade/i.test(refusal), "refusal names the conflicting attribute", refusal);
ok(
  canApproveCandidate({ autoMergeBlocked: false, evidence: { hasConflict: true } } as any).ok === false,
  "a conflict in the evidence blocks approval even if the flag was not set",
);
ok(
  canApproveCandidate(ss304 as any).ok === true,
  "case 1 is approvable by a human",
);
ok(canApproveCandidate(null).ok === true, "a missing candidate does not crash the guard");

// --------------------------------------------------------- human-only mapping
section("A national code exists only because a human decided it");
ok(computeMappings(materials, nmcs, []).length === 0, "no mappings exist with an empty decision log");

const key = pairKey(ss304!.materialIdA, ss304!.materialIdB);
const afterApproval = computeMappings(materials, nmcs, [
  { key, materialIds: [ss304!.materialIdA, ss304!.materialIdB], nationalCode: "NMC-VALVE-000021", by: "steward", at: "2026-01-01T00:00:00.000Z", source: "REVIEW_APPROVAL", evidence: ss304!.evidence },
]);
ok(afterApproval.length === 2, "approval produces one mapping row per record in the pair");
ok(
  afterApproval.every((m: any) => m.nationalCode === "NMC-VALVE-000021"),
  "both records resolve to the approved code",
);
ok(
  afterApproval.every((m: any) => m.approvedBy === "steward" && m.approvedAt),
  "every mapping is attributed to the reviewer who approved it",
);
ok(
  afterApproval.every((m: any) => m.lineage.length === 2),
  "lineage lists every record that converged on the code",
);

// A record covered twice must resolve to exactly one code, matching the record.
const duplicated = computeMappings(materials, nmcs, [
  { key, materialIds: [ss304!.materialIdA, ss304!.materialIdB], nationalCode: "NMC-VALVE-000021", by: "steward", at: "2026-01-01T00:00:00.000Z", source: "REVIEW_APPROVAL" },
  { key: "steward-only", materialIds: [ss304!.materialIdA], nationalCode: "NMC-VALVE-000005", by: "steward", at: "2026-01-02T00:00:00.000Z", source: "STEWARD_MAPPING" },
]);
ok(
  duplicated.filter((m: any) => m.sourceCode === materials.find((x: any) => x.id === ss304!.materialIdA).originalMaterialCode).length === 1,
  "a doubly-assigned record is listed exactly once, not against two codes",
);
ok(
  duplicated.find((m: any) => m.nationalCode === "NMC-VALVE-000005") !== undefined,
  "the later decision wins, consistently with the record itself",
);

// ------------------------------------------------------------- data quality
section("Data quality");
const dq = computeDqRecords(materials);
ok(dq.length > 0, "issues are produced", `count=${dq.length}`);
ok(dq.every((d: any) => typeof d.field === "string" && d.field.length > 0), "every issue names the field at fault");
ok(dq.every((d: any) => typeof d.recommendedAction === "string" && d.recommendedAction.length > 0), "every issue names a concrete action");
ok(dq.every((d: any) => d.severity === "ERROR" || d.severity === "WARNING"), "every issue has a real severity");
ok(
  dq.filter((d: any) => d.issueType === "NON_MATERIAL_RECORD").length ===
    materials.filter((m: any) => m.recordType !== "MATERIAL").length,
  "each non-material record is flagged exactly once",
);
const ids = dq.map((d: any) => d.id);
ok(new Set(ids).size === ids.length, "issue ids are unique");
const again = computeDqRecords(materials);
ok(
  JSON.stringify(again.map((d: any) => d.id)) === JSON.stringify(ids),
  "issue ids are stable across recomputation, so remediation is not lost",
);

// --------------------------------------------------------------- enrichment
section("Legacy record enrichment");
const legacy: any = {
  id: 999,
  sourceOrganization: "LEGACY CPSE",
  originalMaterialCode: "LEG-1",
  originalDescription: "GATE VALVE DN80 PN16 CAST STEEL",
  originalUom: "NOS",
  originalQuantity: "5",
  normalizedDescription: "",
  category: "VALVE",
  lifecycle: "PENDING",
  mappingStatus: "UNMAPPED",
  aiConfidence: null,
  dataQuality: "",
  sourceDocument: "legacy doc",
  sourceRecordId: "LEG-1",
};
const backfilled = enrichRecord(legacy);
ok(backfilled.recordType === "MATERIAL", "record type is backfilled");
ok(!!backfilled.dna && backfilled.dna.category === "VALVE", "DNA is backfilled from the description");
ok(backfilled.origin === "REFERENCE", "a record with no provenance is not silently treated as live");
ok(backfilled.itemLevel === false, "a record with no granularity flag defaults to the safer value");
ok(backfilled.retrievedAt === "", "a missing retrieval date stays empty rather than becoming today");

// --------------------------------------------------------------- migration
section("Storage migration");
store.clear();
store.set("nmm_review_decisions", JSON.stringify([
  { key: pairKey(101, 102), materialIdA: 101, materialIdB: 102, status: "APPROVED", nationalCode: "NMC-VALVE-000021", by: "steward", at: "2026-01-01T00:00:00.000Z" },
  { key: pairKey(777, 778), materialIdA: 777, materialIdB: 778, status: "APPROVED", nationalCode: "NMC-GONE-1", by: "steward", at: "2026-01-01T00:00:00.000Z" },
]));
store.set("nmm_materials", JSON.stringify([{ ...legacy, id: 4242 }]));
store.set("nmm_mappings", JSON.stringify([{ id: 1 }]));
store.set("nmm_schema_version", "0");

migrateStorage();
const kept = JSON.parse(store.get("nmm_review_decisions")!);
ok(kept.length === 1, "decisions about records that still exist are kept", `kept=${kept.length}`);
ok(kept[0].key === pairKey(101, 102), "the surviving decision is the real one");
ok(store.has("nmm_materials"), "genuinely fetched records are not discarded by a migration");
ok(!store.has("nmm_mappings"), "derivable caches are dropped so they cannot show stale data");
ok(Number(store.get("nmm_schema_version")) > 0, "the schema version is recorded");

const before = store.get("nmm_review_decisions");
migrateStorage();
ok(store.get("nmm_review_decisions") === before, "migration is idempotent and does not re-prune on a second run");

// ------------------------------------------------------------------- summary
console.log(`\n${failures === 0 ? "ALL PASS" : "FAILURES"}: ${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
