// @ts-check
/**
 * Library data validator.
 *
 * Loads every JSON file under packages/library/data/ and checks:
 *  1. Required fields present (id, label, kind, source_url).
 *  2. Curves: length_mm ≈ 2π·radius_mm·arc_degrees/360 (within 1 mm).
 *  3. Lengths positive (or null).
 *  4. ids unique within a system.
 *  5. data_quality consistency: "verified" requires every piece to have
 *     a non-null source_verified_at.
 *
 * Exits 0 if all systems pass, 1 otherwise.
 *   pnpm --filter @trackfit/library validate
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const TOLERANCE_MM = 1.0;

function readSystem(filename) {
  const raw = readFileSync(join(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

function checkPiece(systemId, p) {
  const issues = [];

  if (!p.id) issues.push({ system: systemId, severity: "error", message: "piece missing id" });
  if (!p.label) issues.push({ system: systemId, piece: p.id, severity: "error", message: "piece missing label" });
  if (!p.kind) issues.push({ system: systemId, piece: p.id, severity: "error", message: "piece missing kind" });
  if (!p.source_url) issues.push({ system: systemId, piece: p.id, severity: "error", message: "piece missing source_url" });

  if (p.length_mm !== null && typeof p.length_mm === "number" && p.length_mm <= 0) {
    issues.push({
      system: systemId,
      piece: p.id,
      severity: "error",
      message: `length_mm must be positive or null, got ${p.length_mm}`,
    });
  }

  if (p.kind === "curve") {
    const r = p.radius_mm;
    const a = p.arc_degrees;
    const l = p.length_mm;

    if (typeof r === "number" && typeof a === "number" && typeof l === "number") {
      const expected = (2 * Math.PI * r * a) / 360;
      const drift = Math.abs(expected - l);
      if (drift > TOLERANCE_MM) {
        issues.push({
          system: systemId,
          piece: p.id,
          severity: "error",
          message: `curve geometry mismatch: 2π·${r}·${a}/360 = ${expected.toFixed(2)} mm but length_mm = ${l} (drift ${drift.toFixed(2)} mm)`,
        });
      }
    } else if (r === null || a === null || l === null) {
      issues.push({
        system: systemId,
        piece: p.id,
        severity: "warn",
        message: "curve has null geometry fields; UI can't render this piece",
      });
    }

    if (typeof r === "number" && r <= 0) {
      issues.push({ system: systemId, piece: p.id, severity: "error", message: `radius_mm must be positive, got ${r}` });
    }
    if (typeof a === "number" && (a <= 0 || a >= 360)) {
      issues.push({ system: systemId, piece: p.id, severity: "error", message: `arc_degrees must be in (0, 360), got ${a}` });
    }
  }

  return issues;
}

function checkSystem(filename) {
  const sys = readSystem(filename);
  const issues = [];

  if (!sys.id || !sys.name || !sys.manufacturer || !sys.scale) {
    issues.push({
      system: filename,
      severity: "error",
      message: "system missing required field (id / name / manufacturer / scale)",
    });
  }

  if (!Array.isArray(sys.pieces)) {
    issues.push({ system: sys.id ?? filename, severity: "error", message: "system.pieces is not an array" });
    return { issues, pieceCount: 0 };
  }

  for (const p of sys.pieces) {
    issues.push(...checkPiece(sys.id, p));
  }

  const seen = new Set();
  for (const p of sys.pieces) {
    if (seen.has(p.id)) {
      issues.push({ system: sys.id, piece: p.id, severity: "error", message: "duplicate piece id within system" });
    }
    seen.add(p.id);
  }

  if (sys.data_quality === "verified") {
    for (const p of sys.pieces) {
      if (!p.source_verified_at) {
        issues.push({
          system: sys.id,
          piece: p.id,
          severity: "error",
          message: 'system marked "verified" but piece has source_verified_at: null',
        });
      }
    }
  }

  return { issues, pieceCount: sys.pieces.length };
}

const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();

let totalIssues = 0;
let totalErrors = 0;
let totalPieces = 0;

console.log(`Validating ${files.length} library systems under ${DATA_DIR}\n`);

for (const f of files) {
  const { issues, pieceCount } = checkSystem(f);
  totalPieces += pieceCount;
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");
  totalIssues += issues.length;
  totalErrors += errors.length;

  const stamp = errors.length === 0 ? "✓" : "✗";
  console.log(
    `${stamp} ${f.padEnd(36)} ${String(pieceCount).padStart(3)} pieces, ${errors.length} errors, ${warnings.length} warnings`,
  );

  for (const i of issues) {
    const tag = i.severity === "error" ? "ERROR" : "WARN ";
    const where = i.piece ? `${i.system}/${i.piece}` : i.system;
    console.log(`  ${tag} ${where}: ${i.message}`);
  }
}

console.log(
  `\nTotal: ${totalPieces} pieces across ${files.length} systems. ${totalErrors} errors, ${totalIssues - totalErrors} warnings.`,
);

if (totalErrors > 0) process.exit(1);
