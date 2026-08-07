#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Checks the carer PWA's assumptions against a running API.
//
// The spec does not document nine of the routes this app calls, and types
// several response bodies as bare objects. Rather than guess, this signs in as
// a real carer, calls every endpoint the app uses, and prints what came back —
// status, and the top-level keys of the response.
//
// Usage:
//   node scripts/api-probe.mjs --base https://api.example.co.uk/api/v1 \
//                              --email carer@bestpinnacle.test
//
//   Password: PROBE_PASSWORD env var, or you are prompted for it.
//   Never pass a password as an argument — it lands in your shell history.
//
// Read-only by default. Nothing here clocks in, sends a message, marks
// anything read or writes to a carer's record. Pass --writes to include the
// write probes, which are labelled below and still avoid clock events.
// ---------------------------------------------------------------------------

import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, env, exit } from 'node:process';

function arg(name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}

const BASE = (arg('base', env.VITE_API_BASE_URL) || '').replace(/\/$/, '');
const EMAIL = arg('email', 'carer@bestpinnacle.test');
const INCLUDE_WRITES = argv.includes('--writes');

if (!BASE) {
  console.error('Missing --base. Example: --base http://localhost:3001/api/v1');
  exit(1);
}
if (!/\/api\/v\d+$/.test(BASE)) {
  console.error(`Warning: --base does not end in /api/v1 — every path is relative to it.\n  got: ${BASE}\n`);
}

async function password() {
  if (env.PROBE_PASSWORD) return env.PROBE_PASSWORD;
  const rl = createInterface({ input: stdin, output: stdout });
  const value = await rl.question(`Password for ${EMAIL}: `);
  rl.close();
  return value;
}

let token = null;
const results = [];

function shape(value, depth = 0) {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[${value.length} x ${shape(value[0], depth + 1)}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (depth > 0) return `{${keys.slice(0, 8).join(', ')}${keys.length > 8 ? ', …' : ''}}`;
    return `{${keys.join(', ')}}`;
  }
  return typeof value;
}

async function probe(label, method, path, { body, expect = [200, 201, 202, 204] } = {}) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : null),
        ...(token ? { Authorization: `Bearer ${token}` } : null),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text.slice(0, 120);
    }

    const ok = expect.includes(res.status);
    results.push({ label, method, path, status: res.status, ok });
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${String(res.status).padEnd(3)} ${method.padEnd(6)} ${path}`
    );
    if (data !== null) console.log(`         ${shape(data)}`);
    return data;
  } catch (error) {
    results.push({ label, method, path, status: 0, ok: false });
    console.log(`FAIL  0  ${method.padEnd(6)} ${path}`);
    console.log(`         ${error.message}`);
    return null;
  }
}

const login = await (async () => {
  const res = await fetch(`${BASE}/staff/auth/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: await password() }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access) {
    console.error(`\nSign-in failed (${res.status}). ${JSON.stringify(data)?.slice(0, 200)}`);
    exit(1);
  }
  return data;
})();

token = login.access;

console.log(`\nSigned in as ${EMAIL}`);
console.log(`Login response keys: ${shape(login)}`);
console.log(
  login.refresh_token
    ? '  refresh_token: present — /auth/refresh is usable'
    : '  refresh_token: ABSENT — /auth/refresh cannot be used (gap 1 in suggestedMissingEndpoints.md)'
);
console.log('');

// --- Reads: everything the app calls on a normal session -------------------
const me = await probe('me', 'GET', '/staff/me');
if (me) {
  const missing = ['phone', 'emergency_contact_name', 'emergency_contact_phone'].filter(
    (k) => !(k in me)
  );
  if (missing.length) console.log(`         not serialised: ${missing.join(', ')}`);
}

const visits = await probe('visits', 'GET', '/staff/visits');
await probe('summary', 'GET', '/staff/summary');
await probe('availability', 'GET', '/staff/availability');
await probe('timesheet', 'GET', '/staff/timesheet');
await probe('notifications', 'GET', '/notifications');
await probe('notification prefs', 'GET', '/notification_preferences');
await probe('conversations', 'GET', '/conversations');
await probe('sync changes', 'GET', '/staff/sync/changes?since=');

// Detail routes need a real id, so they run only if there is a visit to use.
const firstVisit = Array.isArray(visits) ? visits[0] : null;
if (firstVisit?.id) {
  const detail = await probe(
    'visit detail',
    'GET',
    `/staff/visit_assignments/${firstVisit.id}`
  );
  for (const key of ['care_plan', 'tasks', 'notes']) {
    const items = detail?.[key];
    if (Array.isArray(items) && items.length) {
      console.log(`         ${key}[0]: ${shape(items[0], 1)}`);
    } else {
      console.log(`         ${key}: ${Array.isArray(items) ? 'empty' : 'absent'}`);
    }
  }
} else {
  console.log('\nNo visits returned, so the detail route was not probed.');
  console.log('Give the test carer a published visit to exercise it.');
}

// --- Writes: only with --writes, and nothing that touches a clock record ---
if (INCLUDE_WRITES) {
  console.log('\n--- writes ---');
  await probe('profile patch', 'PATCH', '/staff/me', {
    body: { first_name: me?.first_name, last_name: me?.last_name },
  });
  await probe('devices', 'POST', '/staff/devices', {
    body: { fingerprint: '00000000-0000-4000-8000-000000000001', platform: 'probe' },
  });
} else {
  console.log('\nWrite probes skipped. Re-run with --writes to include them.');
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} endpoints responded as expected.`);
if (failed.length) {
  console.log('Not as expected:');
  for (const f of failed) console.log(`  ${f.status || 'network'}  ${f.method} ${f.path}`);
}
exit(failed.length ? 1 : 0);
