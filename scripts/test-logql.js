'use strict';
// Lightweight CI check: catches broken documented LogQL before dashboards/docs are shipped.
const fs = require('fs');
const path = require('path');
const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'LOGQL.md'), 'utf8');
const queries = [...doc.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((q) => q.includes('{') || q.includes('count_over_time'));
if (queries.length < 6) throw new Error(`Expected at least 6 LogQL queries, got ${queries.length}`);
for (const query of queries) {
  if ((query.match(/\{/g) || []).length !== (query.match(/\}/g) || []).length) throw new Error(`Unbalanced stream selector: ${query}`);
  if (query.includes('| json') && !query.includes('{')) throw new Error(`JSON parser without stream selector: ${query}`);
}
console.log(`Validated ${queries.length} LogQL queries.`);
