#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { allInstitutionalSlugs, FR_PATHS, langFromLocale, pathsFor } from "../src/lib/paths.mjs";

const SLOTS = ["fil", "kicker", "titre", "meta", "cover", "corps", "suite"];
const identity = JSON.parse(fs.readFileSync("src/data/site-identity.json", "utf8"));
const lang = langFromLocale(identity.locale);
const inst = pathsFor(identity.locale, identity.paths);
const SKIP_DIRS = new Set(["category", "contact", "assets", "politique-de-cookies", ...allInstitutionalSlugs()]);

const dist = path.resolve("dist");
if (!fs.existsSync(dist)) {
  console.error("check-article-slots: pas de dist/. Faire astro build d'abord.");
  process.exit(1);
}

function walkHtml(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walkHtml(full, acc);
      continue;
    }
    if (name.endsWith(".html") || name === "robots.txt" || name.endsWith(".xml")) acc.push(full);
  }
  return acc;
}

function articlePages(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(dist, full);
    const top = rel.split(path.sep)[0];
    if (SKIP_DIRS.has(top)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      articlePages(full, acc);
      continue;
    }
    if (name !== "index.html") continue;
    if (rel === "index.html" || rel === "404.html") continue;
    acc.push(full);
  }
  return acc;
}

const FR_LEAKS = [
  `/${FR_PATHS.about}/`,
  `/${FR_PATHS.legal}/`,
  `/${FR_PATHS.privacy}/`,
  'id="contenu"',
  'href="#contenu"',
];

let failed = 0;

if (lang !== "fr") {
  for (const file of walkHtml(dist)) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(dist, file);
    const hits = FR_LEAKS.filter((needle) => text.includes(needle));
    if (hits.length) {
      failed += 1;
      console.error(`FAIL locale ${lang} ${rel}`);
      for (const h of hits) console.error(`  - reste du français public: ${h}`);
    }
  }
  const aboutDir = path.join(dist, inst.about, "index.html");
  if (!fs.existsSync(aboutDir)) {
    failed += 1;
    console.error(`FAIL: page institutionnelle manquante: /${inst.about}/`);
  }
}

const pages = articlePages(dist);
if (pages.length === 0) {
  console.error("check-article-slots: 0 page article dans dist/. Seed draft ? Un article live est requis avant le live.");
  process.exit(1);
}

for (const file of pages) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(dist, file);
  const errors = [];

  const h1 = html.match(/<h1\b/gi) || [];
  if (h1.length !== 1) errors.push(`H1: attendu 1, trouvé ${h1.length}`);
  if (!/<h1\b[^>]*data-slot="titre"/.test(html)) errors.push('le H1 doit porter data-slot="titre"');
  if (!html.includes('type="application/ld+json"')) errors.push("JSON-LD manquant");
  if (html.includes("#person") || html.includes('"@type":"Person"') || html.includes('"@type": "Person"')) {
    errors.push("JSON-LD encore Person");
  }

  const first = {};
  for (const slot of SLOTS) {
    const token = `data-slot="${slot}"`;
    const i = html.indexOf(token);
    if (i < 0) errors.push(`manque ${token}`);
    else first[slot] = i;
  }
  for (let i = 1; i < SLOTS.length; i++) {
    const a = SLOTS[i - 1];
    const b = SLOTS[i];
    if (first[a] == null || first[b] == null) continue;
    if (first[b] < first[a]) errors.push(`ordre: ${b} avant ${a}`);
  }

  if (errors.length) {
    failed += 1;
    console.error(`FAIL ${rel}`);
    for (const e of errors) console.error(`  - ${e}`);
  }
}

if (failed) {
  console.error(`check-article-slots: ${failed} échec(s)`);
  process.exit(1);
}
console.log(`check-article-slots: ${pages.length} page(s) OK (fil → kicker → titre → meta → cover → corps → suite)`);
