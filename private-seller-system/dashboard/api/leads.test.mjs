import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Load the deployable ESM source without changing the parent package's module type.
const source = await readFile(new URL('./leads.js', import.meta.url), 'utf8');
const { handler } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('leads API accepts headers and rejects URL credentials', async () => {
  const saved = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'test-admin-token';
  try {
    const queryOnly = await handler(new Request('https://example.test/api/leads?token=test-admin-token'));
    assert.equal(queryOnly.status, 401);
    const wrongHeader = await handler(new Request('https://example.test/api/leads', { headers: { Authorization: 'Bearer wrong' } }));
    assert.equal(wrongHeader.status, 401);
    // An unsupported method proves auth passed without making a database call.
    const header = await handler(new Request('https://example.test/api/leads', { method: 'POST', headers: { Authorization: 'Bearer test-admin-token' } }));
    assert.equal(header.status, 405);
    const legacy = await handler({ method: 'POST', url: '/api/leads', headers: { authorization: 'Bearer test-admin-token' } });
    assert.equal(legacy.status, 405);
    delete process.env.ADMIN_TOKEN;
    const unconfigured = await handler(new Request('https://example.test/api/leads', { headers: { Authorization: 'Bearer test-admin-token' } }));
    assert.equal(unconfigured.status, 503);
  } finally {
    if (saved === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = saved;
  }
});
