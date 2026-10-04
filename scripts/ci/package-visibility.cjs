'use strict';
// The owner chose public GHCR distribution. Verify that the existing package
// has the expected visibility and recheck before moving the main tag.
const assert = require('node:assert/strict');
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
assert.equal(`${owner}/${repo}`.toLowerCase(), 'acafela-coffee/picpeak');
async function api(route, allowMissing = false) {
  const response = await fetch(`https://api.github.com${route}`, {
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (allowMissing && response.status === 404) return null;
  assert.ok(response.ok, `GitHub API ${route}: ${response.status} ${await response.clone().text()}`);
  return response.json();
}
(async () => {
  const account = await api(`/users/${owner}`);
  const prefix = account.type === 'Organization' ? 'orgs' : 'users';
  const pkg = await api(`/${prefix}/${owner}/packages/container/picpeak%2Faio`);
  assert.equal(pkg.visibility, 'public', 'GHCR package must have the owner-approved public visibility');
  console.log('GHCR visibility: public; owner: ' + owner);

  const main = await api(`/repos/${owner}/${repo}/commits/main`);
  assert.equal(main.sha, process.env.GITHUB_SHA, 'This run no longer represents current main; do not replace its image tag');
})().catch((error) => { console.error(error); process.exitCode = 1; });
