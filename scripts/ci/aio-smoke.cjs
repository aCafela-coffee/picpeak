'use strict';
// Disposable synthetic data only: no host production volume is mounted.
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const image = process.argv[2];
const baseline = require('../../aio-baseline.json');
const platform = process.argv[3] || `linux/${process.arch === 'arm64' ? 'arm64' : 'amd64'}`;
const official = `${baseline.image.split('@')[0]}@${baseline.platformManifestDigests[platform.split('/')[1]]}`;
if (!image) throw new Error('Usage: node scripts/ci/aio-smoke.cjs <local-image>');
const name = `picpeak-smoke-${crypto.randomBytes(5).toString('hex')}`;
const volume = `${name}-data`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
// Avoid reusing a keep-alive socket across recreated Docker port mappings.
const http = (url, options = {}) => fetch(url, { ...options, headers: { connection: 'close', ...options.headers }, signal: options.signal || AbortSignal.timeout(120000) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=';
const shareToken = crypto.randomBytes(24).toString('hex');
let base, adminCookie, galleryCookie, photoId;
async function boot(imageToRun) {
  console.log(`Booting ${imageToRun} (${platform}) on an isolated SQLite volume.`);
  docker('run', '--platform', platform, '-d', '--name', name, '-p', '127.0.0.1::3000', '-v', `${volume}:/data`, '-e', 'TZ=Asia/Seoul', '-e', 'EMAIL_ENABLED=false', imageToRun);
  base = `http://127.0.0.1:${docker('port', name, '3000/tcp').trim().split(':').pop()}`;
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    try { if ((await http(`${base}/health`, { signal: AbortSignal.timeout(5000) })).ok) return; } catch (_) {}
    await wait(1500);
  }
  throw new Error('AIO health endpoint did not become ready');
}
function cookies(response) { return response.headers.getSetCookie().map((v) => v.split(';')[0]).join('; '); }
async function json(route, body, cookie = '') {
  const response = await http(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
  assert.ok(response.ok, `${route}: ${response.status} ${await response.clone().text()}`);
  return response;
}
async function checkData() {
  adminCookie = cookies(await json('/api/auth/admin/login', { username: 'smoke@example.com', password: 'Smoke-Only-2026!Pass' }));
  const events = await http(`${base}/api/admin/events`, { headers: { cookie: adminCookie } });
  assert.equal(events.status, 200);
  assert.match(await events.text(), /한국어 보존 검사/);
  galleryCookie = cookies(await json('/api/auth/gallery/share-login', { slug: 'ko-smoke', token: shareToken }));
  assert.ok(galleryCookie);
  const response = await http(`${base}/api/gallery/ko-smoke/download/${photoId}`, { headers: { cookie: galleryCookie } });
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(png, 'base64'));
}
function snapshot() {
  const program = `
    const { db } = require('./src/database/db');
    (async () => {
      const schema = await db('sqlite_master').select('type','name','tbl_name','sql').whereNot('name','like','sqlite_%').orderBy('name');
      const migrations = await db('migrations').select('*').orderBy('id');
      const values = {};
      for (const table of schema.filter(s => s.type === 'table')) {
        const info = await db(table.name).columnInfo();
        const columns = Object.keys(info).filter(c => /language|locale|currency|amount|minor|price|(?:^|_)rate(?:_|$)/.test(c));
        if (!columns.length) continue;
        const rows = await db(table.name).select(columns);
        values[table.name] = rows.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      }
      const settings = await db('app_settings').select('setting_key','setting_value').where('setting_key','like','%language%').orWhere('setting_key','like','%currency%').orderBy('setting_key');
      console.log(JSON.stringify({schema,migrations,values,settings}));
      await db.destroy();
    })().catch(e => { console.error(e); process.exit(1); });
  `;
  return JSON.parse(docker('exec', name, 'node', '-e', program).trim().split('\n').pop());
}
function setGalleryTheme(theme) {
  const program = `const {db}=require('./src/database/db');(async()=>{await db('events').where({slug:'ko-smoke'}).update({custom_theme_enabled:${theme ? 1 : 0},color_theme:${JSON.stringify(theme)}});await db.destroy()})().catch(e=>{console.error(e);process.exit(1)});`;
  docker('exec', name, 'node', '-e', program);
}
function removeContainer() { docker('stop', name); docker('rm', name); }
(async () => {
  docker('volume', 'create', volume);
  try {
    await boot(official);
    // The official runner checks historical migrations only on existing DBs.
    // Establish the baseline after an official recreation too, so no first-run
    // vs existing-volume behaviour can be mistaken for an overlay migration.
    removeContainer();
    await boot(official);
    const html = await (await http(`${base}/admin`)).text();
    assert.match(html, /<html/);
    console.log('Official baseline ready; creating the synthetic admin and fixtures.');
    const setupToken = docker('exec', name, 'cat', '/data/db/SETUP_TOKEN').trim();
    await json('/api/setup/admin', { token: setupToken, email: 'smoke@example.com', password: 'Smoke-Only-2026!Pass' });
    const seed = `
      const {db}=require('./src/database/db'); const fs=require('fs');
      (async()=>{
        const [customer]=await db('customer_accounts').insert({email:'customer@example.com',password_hash:await require('bcrypt').hash('Smoke-Only-2026!Pass',10),preferred_language:'de',first_name:'한국어 고객'}).returning('id');
        for (const [index,currency] of ['CHF','EUR','USD'].entries()) {
          await db('invoices').insert({invoice_number:'UI-SMOKE-'+index,customer_account_id:customer.id,language:['de','en','fr'][index],currency,issue_date:'2026-10-02',due_date:'2026-10-02',status:'paid',net_amount_minor:10000,vat_amount_minor:2345,total_amount_minor:12345,paid_amount_minor:12345});
        }
        await db('expenses').insert({disposition:'eigener_aufwand',original_currency:'EUR',original_amount_minor:12345,chf_amount_minor:11567,net_amount_minor:10000,vat_amount_minor:1567,gross_amount_minor:11567});
        const [event]=await db('events').insert({slug:'ko-smoke',event_type:'other',event_name:'한국어 보존 검사',event_date:'2026-10-02',host_email:'smoke@example.com',admin_email:'smoke@example.com',password_hash:'unused',require_password:0,share_token:${JSON.stringify(shareToken)},share_link:'/gallery/ko-smoke',expires_at:'2100-01-01',is_active:1,allow_downloads:1}).returning('id');
        const dir='/data/storage/events/active/ko-smoke/individual';fs.mkdirSync(dir,{recursive:true});const file=dir+'/사진.png';fs.writeFileSync(file,Buffer.from(${JSON.stringify(png)},'base64'));
        const [photo]=await db('photos').insert({event_id:event.id,filename:'사진.png',path:'ko-smoke/individual/사진.png',type:'individual',size_bytes:fs.statSync(file).size}).returning('id');
        console.log(JSON.stringify({photoId:photo.id}));await db.destroy();
      })().catch(e=>{console.error(e);process.exit(1)});
    `;
    const seeded = docker('exec', name, 'node', '-e', seed).trim().split('\n').pop();
    photoId = JSON.parse(seeded).photoId;
    const secretHash = docker('exec', name, 'sha256sum', '/data/db/jwt.secret').trim();
    await checkData();
    const reference = snapshot();
    console.log('Official reference schema, migration history, languages and amounts captured.');
    for (const [stage, nextImage] of [['Korean overlay', image], ['Korean recreation', image], ['Official rollback', official]]) {
      removeContainer();
      await boot(nextImage);
      assert.equal(docker('exec', name, 'sha256sum', '/data/db/jwt.secret').trim(), secretHash);
      assert.deepEqual(snapshot(), reference, `${stage}: schema, migrations, stored languages and amounts changed`);
      await checkData();
      if (stage === 'Korean overlay') await require('./korean-ui.cjs')(base, platform, setGalleryTheme);
      assert.deepEqual(snapshot(), reference, `${stage}: stored values changed after login/download`);
      console.log(`${stage} passed (${platform}).`);
    }
    console.log('Official → Korean → recreation → same official digest passed: schema, migrations, languages, amounts, login, event, share, download and persistence.');
  } catch (error) {
    try { console.error(docker('inspect', '--format', '{{json .State}}', name)); } catch (_) {}
    try { console.error(docker('logs', '--tail', '120', name)); } catch (_) {}
    throw error;
  } finally {
    try { docker('rm', '-f', name); } catch (_) {}
    try { docker('volume', 'rm', volume); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
