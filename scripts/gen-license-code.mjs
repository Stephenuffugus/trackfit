#!/usr/bin/env node
/**
 * Trackfit license-code issuer.
 *
 * Generates one or more random TFP-XXXX-XXXX-XXXX codes, hashes each
 * with SHA-256, and prints both the code (to email the buyer) and the
 * hash (to paste into the allowlist in
 * `apps/web/src/lib/premium.ts`).
 *
 * Usage:
 *   node scripts/gen-license-code.mjs                # one code
 *   node scripts/gen-license-code.mjs --count 5      # five codes
 *   node scripts/gen-license-code.mjs --json         # machine-readable
 *
 * After generating: paste the printed hash literal into the
 * VALID_LICENSE_HASHES Set in premium.ts, redeploy, and email the
 * code to the buyer. The user types the code; the app hashes the
 * input and matches against the allowlist. Inspecting the bundled
 * JS only reveals hashes, not codes.
 *
 * Confusing characters (0/O/1/I/L) are excluded from the alphabet so
 * the codes can be read aloud over the phone without ambiguity.
 */

import { randomInt, createHash } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L
const GROUP_LENGTH = 4;
const GROUP_COUNT = 3;
const PREFIX = "TFP";

function generateCode() {
  const groups = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LENGTH; i++) {
      group += ALPHABET[randomInt(0, ALPHABET.length)];
    }
    groups.push(group);
  }
  return `${PREFIX}-${groups.join("-")}`;
}

function hashCode(code) {
  // Match premium.ts: normalise to uppercase + strip whitespace
  // (dashes preserved). The user types this; we hash exactly the
  // same way after normalisation.
  const normalised = code.replace(/\s+/g, "").toUpperCase();
  return createHash("sha256").update(normalised).digest("hex");
}

function parseArgs(argv) {
  const out = { count: 1, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--count" || a === "-n") {
      const v = parseInt(argv[++i], 10);
      if (!Number.isFinite(v) || v < 1) {
        console.error(`Invalid --count: ${argv[i]}`);
        process.exit(2);
      }
      out.count = v;
    } else if (a === "--json") {
      out.json = true;
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/gen-license-code.mjs [--count N] [--json]",
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

function main() {
  const { count, json } = parseArgs(process.argv.slice(2));
  const records = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    const hash = hashCode(code);
    records.push({ code, hash });
  }

  if (json) {
    console.log(JSON.stringify(records, null, 2));
    return;
  }

  for (let i = 0; i < records.length; i++) {
    const { code, hash } = records[i];
    if (i > 0) console.log("");
    console.log(`Code (email this to the buyer):`);
    console.log(`  ${code}`);
    console.log(`Hash (paste into VALID_LICENSE_HASHES in premium.ts):`);
    console.log(`  "${hash}",`);
  }

  if (records.length > 1) {
    console.log("");
    console.log(`Generated ${records.length} codes.`);
  }
}

main();
