'use strict';
// Use only an anonymous pull token: successful checks prove public access.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const baseline = require('../../aio-baseline.json');
const repository = 'acafela-coffee/picpeak/aio';
const revision = process.env.GITHUB_SHA || process.argv[2];
assert.match(revision || '', /^[a-f0-9]{40}$/);
const accept = 'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json';
(async () => {
  const tokenResponse = await fetch(`https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`);
  assert.ok(tokenResponse.ok, `Anonymous token: ${tokenResponse.status}`);
  const { token } = await tokenResponse.json();
  assert.ok(token, 'Missing anonymous pull token');
  async function request(path, method = 'GET') {
    const response = await fetch(`https://ghcr.io/v2/${repository}/${path}`, {
      method, headers: { authorization: `Bearer ${token}`, accept },
      signal: AbortSignal.timeout(120000),
    });
    assert.ok(response.ok, `Anonymous ${method} ${path}: ${response.status}`);
    return response;
  }
  async function manifest(ref) {
    const response = await request(`manifests/${ref}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    assert.equal(response.headers.get('docker-content-digest'), digest);
    return { digest, value: JSON.parse(bytes) };
  }
  const [sha, main] = await Promise.all([manifest(revision), manifest('main')]);
  assert.equal(main.digest, sha.digest, 'main and SHA tags must resolve to the same manifest');
  const platforms = sha.value.manifests.filter(m => m.platform?.os === 'linux' && m.platform.architecture !== 'unknown');
  assert.deepEqual(platforms.map(m => m.platform.architecture).sort(), ['amd64', 'arm64']);
  const digests = {};
  for (const platform of platforms) {
    const child = await manifest(platform.digest);
    assert.equal(child.digest, platform.digest);
    const configResponse = await request(`blobs/${child.value.config.digest}`);
    const configBytes = Buffer.from(await configResponse.arrayBuffer());
    assert.equal(`sha256:${createHash('sha256').update(configBytes).digest('hex')}`, child.value.config.digest);
    const config = JSON.parse(configBytes);
    assert.equal(config.architecture, platform.platform.architecture);
    assert.equal(config.config.Labels['org.opencontainers.image.revision'], revision);
    assert.equal(config.config.Labels['io.picpeak.upstream.commit'], baseline.sourceCommit);
    assert.equal(config.config.Labels['io.picpeak.upstream.image'], baseline.image.split('@')[1]);
    await Promise.all(child.value.layers.map(layer => request(`blobs/${layer.digest}`, 'HEAD')));
    digests[config.architecture] = platform.digest;
  }
  console.log(JSON.stringify({ image: `ghcr.io/${repository}`, revision, manifest: sha.digest, platforms: digests, anonymousPull: true }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
