#!/usr/bin/env python3
"""Compare inert containers: only /app/frontend/dist may differ. No data mounts."""
import hashlib
import json
import subprocess
import sys
import tarfile
import uuid
from pathlib import Path

baseline = json.loads((Path(__file__).resolve().parents[2] / 'aio-baseline.json').read_text())
candidate = sys.argv[1]

def docker(*args):
    return subprocess.check_output(['docker', *args], text=True)

def inspect(image):
    return json.loads(docker('image', 'inspect', image))[0]

candidate_config = inspect(candidate)
arch = candidate_config['Architecture']
manifest = json.loads(docker('buildx', 'imagetools', 'inspect', '--raw', baseline['image']))
actual_digest = next(m['digest'] for m in manifest['manifests'] if m.get('platform', {}).get('architecture') == arch)
assert actual_digest == baseline['platformManifestDigests'][arch], 'Platform digest does not belong to the pinned official index'
official = baseline['image'].split('@')[0] + '@' + actual_digest
docker('pull', '--platform', f'linux/{arch}', official)
configs = [inspect(official), candidate_config]
for field in ('Architecture', 'Os'):
    assert configs[0][field] == configs[1][field], field
for key in set(configs[0]['Config']) | set(configs[1]['Config']):
    if key == 'Labels':
        continue
    assert configs[0]['Config'].get(key) == configs[1]['Config'].get(key), f'Runtime configuration changed: {key}'
assert configs[0]['RootFS']['Layers'] == configs[1]['RootFS']['Layers'][:len(configs[0]['RootFS']['Layers'])], 'Official layers must be inherited'
assert configs[0]['Config']['Labels']['org.opencontainers.image.revision'] == baseline['sourceCommit'], 'Official source/image pair mismatch'

containers = []
def fingerprint(image):
    print(f'Fingerprinting {image}', flush=True)
    name = 'picpeak-invariant-' + uuid.uuid4().hex[:10]
    docker('create', '--platform', f'linux/{arch}', '--name', name, image)
    containers.append(name)
    process = subprocess.Popen(['docker', 'export', name], stdout=subprocess.PIPE)
    result = {}
    with tarfile.open(fileobj=process.stdout, mode='r|') as archive:
        for entry in archive:
            path = entry.name.rstrip('/')
            if path == 'app/frontend/dist' or path.startswith('app/frontend/dist/'):
                continue
            # Docker synthesizes these per-container files and volume contents.
            if path in ('etc/hosts', 'etc/hostname', 'etc/resolv.conf') or path == 'data' or path.startswith('data/'):
                continue
            # Docker Desktop/Rosetta adds these two empty mount-point directories
            # while executing an amd64 build on macOS. Native Linux CI has no
            # exception; cache files (if any) are still compared everywhere.
            if sys.platform == 'darwin' and entry.isdir() and path in ('root/.cache', 'root/.cache/rosetta'):
                continue
            digest = None
            if entry.isfile():
                digestor = hashlib.sha256()
                stream = archive.extractfile(entry)
                while chunk := stream.read(1024 * 1024):
                    digestor.update(chunk)
                digest = digestor.hexdigest()
            result[path] = (entry.type.decode(), entry.mode, entry.uid, entry.gid, entry.linkname, digest)
    process.stdout.close()
    assert process.wait() == 0, 'docker export failed'
    return result

try:
    a, b = fingerprint(official), fingerprint(candidate)
    changes = [path for path in sorted(a.keys() | b.keys()) if a.get(path) != b.get(path)]
    assert not changes, f'Runtime files changed outside frontend/dist: {changes[:30]}'
    print('Image invariant passed: runtime configuration, backend, migrations, dependencies and filesystem unchanged.')
finally:
    for name in containers:
        subprocess.run(['docker', 'rm', '-v', name], check=True, stdout=subprocess.DEVNULL)
