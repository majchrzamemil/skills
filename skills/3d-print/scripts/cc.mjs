#!/usr/bin/env node
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createSocket } from 'node:dgram';
import { basename } from 'node:path';
import { parseArgs, die, log, warn, md5, uuid, now, sleep, bytes } from './lib/util.mjs';

const WS_PORT = 3030;
const HTTP_PORT = 3030;
const UDP_PORT = 3000;

function requireWebSocket() {
  if (typeof WebSocket === 'undefined') {
    die('this script needs the built-in WebSocket, which requires Node 22+. Current: ' + process.version);
  }
}

function requireIp(flags) {
  const ip = flags.ip || flags.host;
  if (!ip) die('missing --ip <printer-ip>');
  return ip;
}

function discover({ broadcast = '255.255.255.255', timeout = 2500 } = {}) {
  return new Promise((resolve) => {
    const sock = createSocket({ type: 'udp4', reuseAddr: true });
    const found = new Map();
    sock.on('message', (msg, rinfo) => {
      try {
        found.set(rinfo.address, JSON.parse(msg.toString()));
      } catch {
        found.set(rinfo.address, { raw: msg.toString() });
      }
    });
    sock.on('error', () => {});
    try {
      sock.bind(() => {
        try {
          sock.setBroadcast(true);
          sock.send(Buffer.from('M99999'), UDP_PORT, broadcast);
        } catch {}
      });
    } catch {}
    setTimeout(() => {
      try {
        sock.close();
      } catch {}
      resolve([...found.entries()].map(([ip, msg]) => ({ ip, ...msg })));
    }, timeout);
  });
}

function buildRequest(cmd, data, mainboardId) {
  return {
    Id: uuid(),
    Data: {
      Cmd: cmd,
      Data: data || {},
      RequestID: uuid(),
      MainboardID: mainboardId || '',
      TimeStamp: now(),
      From: 0,
    },
    Topic: `sdcp/request/${mainboardId || ''}`,
  };
}

function openWs(ip, timeoutMs = 8000) {
  requireWebSocket();
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(`ws://${ip}:${WS_PORT}/websocket`);
    } catch (e) {
      reject(e);
      return;
    }
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error(`websocket to ${ip}:${WS_PORT} timed out`));
    }, timeoutMs);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`websocket error connecting to ${ip}:${WS_PORT}`));
    });
  });
}

async function session(ip, cmds, waitMs = 4000) {
  const ws = await openWs(ip);
  const out = { responses: [], status: null, attributes: null, errors: [], mainboardId: '' };
  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    const topic = msg.Topic || '';
    if (!out.mainboardId && msg.MainboardID) out.mainboardId = msg.MainboardID;
    const data = msg.Data || msg;
    if (topic.includes('/status/')) out.status = data.Status || data || out.status;
    else if (topic.includes('/attributes/')) out.attributes = data.Attributes || data || out.attributes;
    else if (topic.includes('/response/')) out.responses.push(data);
    else if (topic.includes('/error/')) out.errors.push(data);
  });
  for (const c of cmds) ws.send(JSON.stringify(buildRequest(c.cmd, c.data, c.id)));
  await sleep(waitMs);
  try {
    ws.close();
  } catch {}
  return out;
}

async function resolveId(ip, idFlag) {
  if (idFlag) return idFlag;
  const found = await discover({ timeout: 1500 });
  const match = found.find((f) => f.ip === ip) || found[0];
  if (!match) return '';
  return match.MainboardID || (match.Data && match.Data.MainboardID) || '';
}

function summarizeStatus(s) {
  if (!s) return null;
  const info = s.PrintInfo || {};
  return {
    machine_state: s.CurrentStatus,
    nozzle: { current: s.TempOfNozzle, target: s.TempTargetNozzle },
    bed: { current: s.TempOfHotbed, target: s.TempTargetHotbed },
    position: s.CurrenCoord || s.CurrentCoord,
    filename: info.Filename,
    print_status: info.Status,
    layer: info.TotalLayer ? `${info.CurrentLayer}/${info.TotalLayer}` : undefined,
    progress_percent: info.Progress,
    progress_seconds: info.TotalTicks ? `${info.CurrentTicks}/${info.TotalTicks}` : undefined,
    error_number: info.ErrorNumber,
  };
}

async function cmdDiscover(flags) {
  const broadcast = flags.broadcast || '255.255.255.255';
  const timeout = flags.timeout ? Number(flags.timeout) : 2500;
  const found = await discover({ broadcast, timeout });
  log(JSON.stringify({ broadcast, found }, null, 2));
}

async function cmdStatus(flags) {
  const ip = requireIp(flags);
  const id = await resolveId(ip, flags.id);
  const s = await session(ip, [
    { cmd: 1, id },
    { cmd: 0, id },
  ]);
  log(JSON.stringify({
    ip,
    mainboard_id: id || s.mainboardId,
    state: summarizeStatus(s.status),
    attributes: s.attributes ? {
      name: s.attributes.Name,
      firmware: s.attributes.FirmwareVersion,
      build_volume: s.attributes.XYZsize,
      network: s.attributes.NetworkStatus,
      usb: s.attributes.UsbDiskStatus,
      camera: s.attributes.CameraStatus,
    } : null,
    errors: s.errors,
  }, null, 2));
}

async function cmdWatch(flags) {
  const ip = requireIp(flags);
  const id = await resolveId(ip, flags.id);
  const seconds = flags.seconds ? Number(flags.seconds) : 30;
  const ws = await openWs(ip);
  let count = 0;
  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if ((msg.Topic || '').includes('/status/')) {
      count++;
      const data = msg.Data || msg;
      log(JSON.stringify({ t: now(), ...summarizeStatus(data.Status || data) }));
    } else if ((msg.Topic || '').includes('/error/')) {
      log(JSON.stringify({ t: now(), error: msg.Data || msg }));
    }
  });
  ws.send(JSON.stringify(buildRequest(1, {}, id)));
  ws.send(JSON.stringify(buildRequest(0, {}, id)));
  await sleep(seconds * 1000);
  try {
    ws.close();
  } catch {}
  log(JSON.stringify({ done: true, status_messages: count }));
}

async function cmdFiles(flags) {
  const ip = requireIp(flags);
  const id = await resolveId(ip, flags.id);
  const url = flags.path || '/local/';
  const s = await session(ip, [{ cmd: 258, data: { Url: url }, id }], 4000);
  log(JSON.stringify({ ip, path: url, responses: s.responses }, null, 2));
}

async function cmdUpload(flags, positionals) {
  const ip = requireIp(flags);
  const file = positionals[0] || flags.file;
  if (!file) die('usage: cc.mjs upload --ip <ip> <file.gcode>');
  if (!existsSync(file)) die(`no such file: ${file}`);
  const buf = readFileSync(file);
  const name = basename(file);
  const form = new FormData();
  form.append('S-File-MD5', md5(buf));
  form.append('Check', '1');
  form.append('Offset', '0');
  form.append('Uuid', uuid().replace(/-/g, ''));
  form.append('TotalSize', String(buf.length));
  form.append('File', new Blob([buf], { type: 'application/octet-stream' }), name);
  const res = await fetch(`http://${ip}:${HTTP_PORT}/uploadFile/upload`, { method: 'POST', body: form });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  const ok = res.ok && parsed.success === true;
  log(JSON.stringify({ ip, file: name, size: bytes(buf.length), http_status: res.status, ok, response: parsed }, null, 2));
  if (!ok) process.exit(1);
}

async function cmdPrint(flags, positionals) {
  const ip = requireIp(flags);
  const id = await resolveId(ip, flags.id);
  const file = flags.file || positionals[0];
  if (!file) die('usage: cc.mjs print --ip <ip> --file <name.gcode> [--start-layer 0] [--level 1|0]');
  const startLayer = flags['start-layer'] ? Number(flags['start-layer']) : 0;
  const autoLevel = flags.level === undefined ? 1 : Number(flags.level);
  // CC1 firmware hangs (port 3030 refuses) on a start command missing any of these fields.
  const data = {
    Filename: file,
    StartLayer: startLayer,
    Calibration_switch: autoLevel,
    PrintPlatformType: 0,
    Tlp_Switch: 0,
    slot_map: [],
  };
  const s = await session(ip, [{ cmd: 128, data, id }], 4000);
  const ack = s.responses[0] && s.responses[0].Data ? s.responses[0].Data.Ack : undefined;
  log(JSON.stringify({ ip, file, start_layer: startLayer, ack, responses: s.responses, errors: s.errors }, null, 2));
}

async function cmdControl(flags, cmd, label) {
  const ip = requireIp(flags);
  const id = await resolveId(ip, flags.id);
  const s = await session(ip, [{ cmd, id }], 3000);
  log(JSON.stringify({ ip, action: label, responses: s.responses, errors: s.errors }, null, 2));
}

function main() {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  const cmd = positionals.shift();
  const run = async () => {
    switch (cmd) {
      case 'discover': return cmdDiscover(flags);
      case 'status': return cmdStatus(flags);
      case 'watch': return cmdWatch(flags);
      case 'files': return cmdFiles(flags);
      case 'upload': return cmdUpload(flags, positionals);
      case 'print': return cmdPrint(flags, positionals);
      case 'pause': return cmdControl(flags, 129, 'pause');
      case 'resume': return cmdControl(flags, 131, 'resume');
      case 'stop': return cmdControl(flags, 130, 'stop');
      default:
        die('usage: cc.mjs <discover|status|watch|files|upload|print|pause|resume|stop> [--ip <ip>]');
    }
  };
  run().catch((e) => die(e.message || String(e)));
}

main();
