#!/usr/bin/env ts-node
/**
 * Demo seed script: creates a 30-lead CSV at /tmp/demo-leads.csv
 * Run with: npm run demo:seed
 */
import * as fs from 'fs';
import * as path from 'path';

const leads = Array.from({ length: 30 }, (_, i) => `demo.lead.${i + 1}@ethereal.email`);
const content = leads.join('\n') + '\n';

const outputPath = process.env['DEMO_CSV_OUTPUT'] ?? path.join(process.env['TEMP'] ?? '/tmp', 'demo-leads.csv');
fs.writeFileSync(outputPath, content, 'utf-8');
console.log(`✅ Created ${leads.length} leads at: ${outputPath}`);
