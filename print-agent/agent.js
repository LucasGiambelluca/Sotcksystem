#!/usr/bin/env node
/**
 * 🖨️  LOCAL PRINT AGENT  (pure TCP, no native deps)
 * -------------------------------------------------
 * Replaces the RawBT Android app. Runs on any always-on device on the SAME
 * Wi-Fi/LAN as the thermal printer (here: a Termux session on the in-store
 * Android tablet).
 *
 * How it works:
 *   1. Polls the Supabase `print_queue` table for status='pending' jobs.
 *   2. Each job's `raw_content` is base64 of a COMPLETE ESC/POS ticket
 *      (header + logo + items + cut) — already built server-side.
 *   3. Opens a raw TCP socket to the printer (port 9100) and writes the bytes.
 *   4. Marks the job 'printed' or 'failed'.
 *
 * Only ONE consumer may run at a time (this agent). The browser RawBT bridge
 * (PrinterBridge.tsx) and the VPS printer-bridge.ts must stay OFF, or jobs get
 * printed twice / failed by a host that can't reach the LAN.
 *
 * Run:  node agent.js   (see README.md for Termux setup)
 */

'use strict';

const net = require('net');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PRINTER_IP = process.env.PRINTER_IP || '192.168.1.46';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100', 10);
const POLL_MS = parseInt(process.env.POLL_MS || '3000', 10);
const SOCKET_TIMEOUT_MS = parseInt(process.env.SOCKET_TIMEOUT_MS || '8000', 10);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// Jobs currently being handled in THIS process, so overlapping polls don't
// grab the same row twice.
const inFlight = new Set();

console.log('🚀 Print agent iniciado.');
console.log(`   Impresora: ${PRINTER_IP}:${PRINTER_PORT}`);
console.log(`   Poll cada ${POLL_MS}ms`);

/** Send a raw ESC/POS buffer to the network printer over TCP 9100. */
function printRaw(buffer) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };

    socket.setTimeout(SOCKET_TIMEOUT_MS);
    socket.once('error', done);
    socket.once('timeout', () => done(new Error('printer socket timeout')));
    socket.once('close', () => done()); // resolves on graceful end (no prior error)

    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      socket.write(buffer, () => socket.end()); // flush, then close cleanly
    });
  });
}

async function handleJob(job) {
  if (inFlight.has(job.id)) return;
  inFlight.add(job.id);
  try {
    const buffer = Buffer.from(job.raw_content, 'base64');
    await printRaw(buffer);
    await supabase
      .from('print_queue')
      .update({ status: 'printed', printed_at: new Date().toISOString() })
      .eq('id', job.id);
    console.log(`✅ Impreso ${job.id}`);
  } catch (e) {
    const msg = String((e && e.message) || e);
    await supabase
      .from('print_queue')
      .update({ status: 'failed', error_message: msg })
      .eq('id', job.id);
    console.error(`❌ Falló ${job.id}: ${msg}`);
  } finally {
    inFlight.delete(job.id);
  }
}

async function poll() {
  try {
    const { data: jobs, error } = await supabase
      .from('print_queue')
      .select('id, raw_content')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('⚠️  Error consultando cola:', error.message);
      return;
    }
    for (const job of jobs || []) {
      // Sequential: a cheap thermal printer can't take parallel sockets.
      await handleJob(job);
    }
  } catch (e) {
    console.error('⚠️  Error en poll:', (e && e.message) || e);
  }
}

// Simple, sleep-resilient loop (better than realtime websockets on Android Doze).
(async function loop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await poll();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
})();

process.on('SIGINT', () => {
  console.log('\n👋 Agente detenido.');
  process.exit(0);
});
