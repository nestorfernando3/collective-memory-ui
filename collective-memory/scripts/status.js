#!/usr/bin/env node
/**
 * /memoria status — Project Intelligence Dashboard
 * Reads all project cards from collective-memory/projects/ and outputs
 * a prioritized, at-a-glance status table grouped by urgency.
 * 
 * Usage: node collective-memory/scripts/status.js
 */

const fs = require('fs');
const path = require('path');

const MEMORIA_DIR = path.join(__dirname, '..');
const PROJECTS_DIR = path.join(MEMORIA_DIR, 'projects');

// Status tiering — determines which ring of urgency a project lands in
const TIER = {
  critical: ['en proceso', 'en desarrollo', 'en construcción', 'en postulación', 'en ejecución'],
  active:   ['activo', 'active', 'materiales listos'],
  pending:  ['enviado', 'submitted', 'maquetado', 'libro formateado'],
  done:     ['completo', 'complete', 'publicado', 'published'],
};

function getTier(status = '') {
  const s = status.toLowerCase().replace(/_/g, ' ');
  if (TIER.critical.some(t => s.includes(t))) return 'critical';
  if (TIER.active.some(t => s.includes(t))) return 'active';
  if (TIER.pending.some(t => s.includes(t))) return 'pending';
  if (TIER.done.some(t => s.includes(t))) return 'done';
  return 'unknown';
}

const TIER_LABELS = {
  critical: '🔴 EN PROGRESO',
  active:   '🟡 ACTIVO',
  pending:  '🟠 PENDIENTE / ENVIADO',
  done:     '🟢 COMPLETO',
  unknown:  '⚪ SIN CLASIFICAR',
};

const TIER_ORDER = ['critical', 'active', 'pending', 'done', 'unknown'];

function loadProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`❌ No se encontró la base de datos en ${PROJECTS_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8'));
    } catch {
      return null;
    }
  }).filter(project => {
    if (!project) return false;
    const normalizedPath = String(project.path || '').replace(/\\/g, '/');
    return !(normalizedPath.includes('/demo/') || normalizedPath.startsWith('~/demo'));
  });
}

function truncate(str, len) {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function pad(str, len) {
  return String(str || '').padEnd(len);
}

function printDashboard(projects) {
  const byTier = {};
  TIER_ORDER.forEach(t => byTier[t] = []);
  projects.forEach(p => {
    const tier = getTier(p.status);
    byTier[tier].push(p);
  });

  console.log('\n');
  console.log('█████████████████████████████████████████████████████████████');
  console.log('  MEMORIA COLECTIVA — DASHBOARD DE ESTADO');
  console.log(`  ${new Date().toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`);
  console.log('█████████████████████████████████████████████████████████████\n');

  let totalShown = 0;

  TIER_ORDER.forEach(tier => {
    const group = byTier[tier];
    if (!group.length) return;

    console.log(`\n${TIER_LABELS[tier]} (${group.length})`);
    console.log('─'.repeat(65));
    console.log(`  ${'PROYECTO'.padEnd(36)} ${'TIPO'.padEnd(14)} ${'ESTADO'}`);
    console.log('─'.repeat(65));

    group.forEach(p => {
      const name = truncate(p.name || p.title || p.id, 35);
      const type = truncate(p.type, 13);
      const status = p.status || '—';
      console.log(`  ${pad(name, 36)} ${pad(type, 14)} ${status}`);
      if (p.description) {
        console.log(`  ${''.padEnd(4)}↳ ${truncate(p.description, 72)}`);
      }
      totalShown++;
    });
  });

  console.log('\n' + '─'.repeat(65));
  console.log(`  TOTAL: ${totalShown} proyectos registrados`);
  console.log('█████████████████████████████████████████████████████████████\n');
}

const projects = loadProjects();
printDashboard(projects);
