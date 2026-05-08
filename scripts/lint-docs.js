#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/lint-docs.js — R-CI-DOCS-001.
 *
 * Four lints in one pass over the docs/ tree:
 *   1. Cross-document anchor resolution: every `[label](FILE.md#anchor)`
 *      that points to one of the canonical docs MUST resolve to either
 *      a heading slug present in the target file, or an explicit
 *      `<a id="..."></a>` anchor.
 *   2. Decree-citation traceability (doctrine A-6): every art./D.Lgs./
 *      Reg. UE / CVE / GHSA reference in HANDOFF/AUDIT/REMEDIATION/UPLIFT
 *      must match either an entry in HANDOFF Appendix A, or be itself
 *      defined inside Appendix A. Heuristic but tight.
 *   3. Word-count floor: each of HANDOFF/AUDIT/REMEDIATION/UPLIFT >=
 *      MIN_WORDS (18000 — the published v1.0 target is 20k; leave
 *      slack for legitimate compaction).
 *   4. Last-reviewed freshness: AUDIT § 9 / REMEDIATION § 1 carry a
 *      `**Data:**` line; if older than MAX_AGE_DAYS (95), fail.
 *
 * Exits non-zero on any failure. Stdout enumerates every problem so a
 * single CI run names everything that needs fixing.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const CANONICAL = ['HANDOFF.md', 'AUDIT.md', 'REMEDIATION.md', 'UPLIFT.md'];
const MIN_WORDS = 18000;
const MAX_AGE_DAYS = 95;

// Known-pending anchor inconsistencies tracked as separate work; the
// lint warns but does not fail on these. New entries should be added
// only with a one-line rationale and a follow-up ticket reference.
const ANCHOR_ALLOWLIST = new Set([
  // F-MED-001 / F-MED-005: REMEDIATION cross-refs use shorthand IDs that
  // were never realised as actual headings in AUDIT (the underlying
  // findings are noted inline in F-CRIT-001 mitigation paragraphs and in
  // F-MED-DATA-/F-MED-CODE- series). Tracked as R-AUDIT-MED-IDS-001
  // for the next quarterly review (HANDOFF doctrine H-22).
  'AUDIT.md#a-finding-f-med-005',
  'AUDIT.md#a-finding-f-med-001',
  // F-XXX placeholder appears in a forward-looking discussion of
  // future findings; not a real reference.
  'AUDIT.md#a-finding-f-xxx'
  // R-TOS-BREACH-001 was previously allowlisted because the ticket was
  // referenced from AUDIT but never filed in REMEDIATION. The ticket
  // landed in REMEDIATION § 7 W3 during the 2026-05-08 audit reconciliation;
  // the anchor now resolves naturally. Allowlist entry removed.
]);

const errors = [];
const warnings = [];

function read(name) {
  return fs.readFileSync(path.join(DOCS_DIR, name), 'utf8');
}

// ----------------------------------------------------------------- 1. Anchors
function slugify(headingText) {
  // Approximation of GitHub's slugifier: lowercase, drop everything that
  // isn't [a-z0-9 -], collapse whitespace to '-'. Backticks and special
  // chars are stripped, which matches `### 8.3 Runbook — \`FactoryMindAPIDown\``
  // → "83-runbook--factorymindapidown".
  return headingText
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/—/g, '')
    .replace(/[^a-z0-9 \-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function collectAnchors(text) {
  const anchors = new Set();
  // Heading-derived slugs.
  const headingRe = /^#{1,6}\s+(.+?)\s*$/gm;
  let m;
  while ((m = headingRe.exec(text))) {
    anchors.add(slugify(m[1]));
  }
  // Explicit HTML anchors.
  const htmlRe = /<a\s+id="([^"]+)"\s*><\/a>/g;
  while ((m = htmlRe.exec(text))) {
    anchors.add(m[1]);
  }
  return anchors;
}

// The doc set uses convention prefixes (`r-ticket-`, `a-finding-`,
// `a-doctrine-`, `a-strength-`) where the suffix maps to a heading slug
// without the prefix. `r-ticket-r-mqtt-anon-001` matches the heading
// `### R-MQTT-ANON-001 — ...` (which slugifies to start with
// `r-mqtt-anon-001-`). The lint allows either form: an exact match
// against a slug or HTML id, or a prefix-match of the suffix-only form
// against any heading slug.
const PREFIXES = ['r-ticket-', 'a-finding-', 'a-doctrine-', 'a-strength-'];

function anchorResolves(anchor, slugs) {
  if (slugs.has(anchor)) return true;
  for (const prefix of PREFIXES) {
    if (anchor.startsWith(prefix)) {
      const suffix = anchor.slice(prefix.length);
      for (const s of slugs) {
        if (s === suffix || s.startsWith(suffix + '-') || s.startsWith(suffix + '--')) {
          return true;
        }
      }
    }
  }
  return false;
}

function lintAnchors() {
  const sources = {};
  for (const f of CANONICAL) {
    sources[f] = read(f);
  }
  const anchorIndex = {};
  for (const f of CANONICAL) {
    anchorIndex[f] = collectAnchors(sources[f]);
  }

  for (const f of CANONICAL) {
    const text = sources[f];
    // [label](TARGET.md#anchor) — relative cross-doc references only.
    const re = /\]\(([A-Z_]+\.md)#([a-z0-9\-_]+)\)/g;
    let m;
    while ((m = re.exec(text))) {
      const target = m[1];
      const anchor = m[2];
      if (!CANONICAL.includes(target)) continue; // ignore non-canonical
      const slugs = anchorIndex[target] || new Set();
      if (anchorResolves(anchor, slugs)) continue;
      const key = `${target}#${anchor}`;
      if (ANCHOR_ALLOWLIST.has(key)) {
        warnings.push(`anchor (allowlisted): ${f} → ${key}`);
      } else {
        errors.push(`anchor: ${f} → ${key} does not resolve`);
      }
    }
  }
}

// ----------------------------------------------------------------- 2. Citations
function lintDecreeCitations() {
  const handoff = read('HANDOFF.md');
  const appendixIdx = handoff.toLowerCase().indexOf('appendix a');
  if (appendixIdx < 0) {
    errors.push('citations: HANDOFF.md missing Appendix A — cannot validate decree-citation traceability');
    return;
  }
  const appendix = handoff.slice(appendixIdx);

  // Patterns: D.Lgs. NNN/YYYY, Reg. UE NNNN/NN, CVE-YYYY-NNNNN, GHSA-XXXX-XXXX-XXXX.
  const patterns = [
    /D\.Lgs\.\s+\d+\/\d{4}/g,
    /D\.Lgs\.\s+\d+\s+\w+\s+\d{4},?\s*n\.\s*\d+/g,
    /Reg\.\s*UE\s*\d+\/\d+/g,
    /Decisione\s+UE\s*\d+\/\d+/g,
    /CVE-\d{4}-\d{4,7}/g,
    /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/gi
  ];

  const allCitations = new Set();
  for (const f of CANONICAL) {
    const text = read(f);
    for (const re of patterns) {
      const matches = text.match(re) || [];
      for (const c of matches) allCitations.add(c.trim());
    }
  }

  for (const c of allCitations) {
    if (!appendix.includes(c)) {
      errors.push(`citation: ${c} is referenced in canonical docs but NOT in HANDOFF Appendix A`);
    }
  }
}

// ---------------------------------------------------------------- 3. Word count
function lintWordCount() {
  for (const f of CANONICAL) {
    const text = read(f);
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words < MIN_WORDS) {
      errors.push(`word-count: ${f} has ${words} words; floor is ${MIN_WORDS}`);
    }
  }
}

// ---------------------------------------------------------------- 4. Freshness
function lintFreshness() {
  // AUDIT § 9 and REMEDIATION § 1 each carry a `**Data:**` line near the
  // top declaring when the document was last reviewed. We grep the
  // first occurrence in each.
  const targets = ['AUDIT.md', 'REMEDIATION.md'];
  const today = new Date();
  for (const f of targets) {
    const text = read(f);
    const m = text.match(/\*\*(?:Data|Last reviewed)[^*]*\*\*[^0-9]*(\d{4}-\d{2}-\d{2})/);
    if (!m) {
      errors.push(`freshness: ${f} has no parseable Data: line`);
      continue;
    }
    const date = new Date(m[1]);
    const ageDays = (today - date) / 86_400_000;
    if (ageDays > MAX_AGE_DAYS) {
      errors.push(`freshness: ${f} last reviewed ${m[1]} (${ageDays.toFixed(0)} days ago); cap is ${MAX_AGE_DAYS}`);
    }
  }
}

// ------------------------------------------------------------------- main
lintAnchors();
lintDecreeCitations();
lintWordCount();
lintFreshness();

if (warnings.length > 0) {
  console.warn(`docs-lint: ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn(`  ! ${w}`);
  console.warn('');
}
if (errors.length === 0) {
  console.log('docs-lint: OK (anchors + decrees + word-count + freshness all pass)');
  process.exit(0);
} else {
  console.error(`docs-lint: ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
