#!/usr/bin/env bash
#
# ILLUSTRATIVE SAMPLE SEED SCRIPT
# ===============================
# Loads ./sample-data.csv into the running platform as an ILLUSTRATIVE EXAMPLE.
# The file is clearly marked as illustrative - replace with real government
# procurement / CPSE data for actual use.
#
# It splits the sample across two CPSEs (IOCL, BPCL) by alternating rows to
# demonstrate cross-CPSE matching.
#
# Usage: ./ingest-sample.sh [BACKEND_URL] [USERNAME] [PASSWORD]
set -euo pipefail

BACKEND="${1:-http://localhost:8080/api}"
USERNAME="${2:-admin}"
PASSWORD="${3:-admin123}"

TOKEN=$(curl -s -X POST "$BACKEND/auth/login" -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

DATA_FILE="$(dirname "$0")/sample-data.csv"
TMPDIR="$(mktemp -d)"

# Split even/odd rows into two CPSE files
awk 'NR>1 && !/^#/' "$DATA_FILE" > "$TMPDIR/all.csv"
python3 - "$TMPDIR/all.csv" "$TMPDIR" <<'PY'
import sys, csv, os
src, out = sys.argv[1], sys.argv[2]
rows = list(csv.reader(open(src)))
for i, r in enumerate(rows):
    if not r: continue
    org = "IOCL" if i % 2 == 0 else "BPCL"
    fn = os.path.join(out, org + ".csv")
    if not os.path.exists(fn):
        with open(fn, "w") as f:
            f.write("material_code,description,uom,quantity\n")
    with open(fn, "a") as f:
        f.write(",".join(r) + "\n")
PY

for ORG in IOCL BPCL; do
  echo "Importing $ORG (illustrative sample)..."
  JOB=$(curl -s -X POST "$BACKEND/import/create" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"sourceOrganization\":\"$ORG\",\"sourceType\":\"ILLUSTRATIVE_SAMPLE\",\"sourceDocument\":\"sample-data.csv\",\"uploadedBy\":\"admin\"}")
  JOB_ID=$(echo "$JOB" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
  curl -s -X POST "$BACKEND/import/$JOB_ID/upload" -H "Authorization: Bearer $TOKEN" \
    -F "file=@$TMPDIR/$ORG.csv"
  echo ""
done

rm -rf "$TMPDIR"
echo "Done. Sample records ingested as ILLUSTRATIVE example across IOCL and BPCL."
