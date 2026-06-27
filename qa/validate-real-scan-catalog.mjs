import fs from 'node:fs';

const path = process.argv[2] ?? 'qa/real-scan-photo-catalog.json';
const catalog = JSON.parse(fs.readFileSync(path, 'utf8'));
const cases = Array.isArray(catalog.cases) ? catalog.cases : [];
const ids = new Set();
const duplicateIds = [];
const invalidCases = [];

for (const item of cases) {
  if (ids.has(item.id)) duplicateIds.push(item.id);
  ids.add(item.id);

  if (!item.id || !item.category || !item.expectedRating || typeof item.scoreMin !== 'number' || typeof item.scoreMax !== 'number' || !item.expectedConfidence) {
    invalidCases.push(item.id ?? '<missing-id>');
  }
  if (item.scoreMin < 0 || item.scoreMax > 100 || item.scoreMin > item.scoreMax) {
    invalidCases.push(`${item.id}:score-range`);
  }
}

const categories = new Set(cases.map((item) => item.category));
const missingCategories = catalog.categoriesRequired.filter((category) => !categories.has(category));
const countOk = cases.length >= catalog.minimumRequiredCases;

const report = {
  version: catalog.version,
  total: cases.length,
  required: catalog.minimumRequiredCases,
  countOk,
  categoryCount: categories.size,
  missingCategories,
  duplicateIds,
  invalidCases,
  ok: countOk && missingCategories.length === 0 && duplicateIds.length === 0 && invalidCases.length === 0,
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
