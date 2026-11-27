import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicShareUrl } from './share-url.js';

test('builds a stable public share URL rather than using a deployment preview host', () => {
  const url = new URL(buildPublicShareUrl('அத்தியாயம்-4'));

  assert.equal(url.origin, 'https://rudhraprarthananovels.com');
  assert.equal(url.pathname, '/share');
  assert.equal(url.searchParams.get('id'), 'அத்தியாயம்-4');
});

test('builds the canonical site share landing URL when no content ID is supplied', () => {
  assert.equal(buildPublicShareUrl(), 'https://rudhraprarthananovels.com/share');
});
