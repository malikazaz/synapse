import test from 'node:test';
import assert from 'node:assert/strict';
import {consentPolicy} from '../server/auth';

test('consent permits the validated OAuth callback origin without exposing query parameters',()=>{
  const policy=consentPolicy('https://chatgpt.com/connector/callback?state=private');
  assert.match(policy,/form-action 'self' https:\/\/chatgpt\.com$/);
  assert.match(policy,/frame-ancestors 'none'/);
  assert.ok(!policy.includes('private'));
  assert.ok(!policy.includes('*'));
});

test('consent rejects callback origins that cannot be safely represented in CSP',()=>{
  assert.throws(()=>consentPolicy('javascript:alert(1)'));
  assert.throws(()=>consentPolicy('https://example.test;unsafe'));
  assert.match(consentPolicy('http://127.0.0.1:5000/callback'),/http:\/\/127\.0\.0\.1:5000$/);
});
