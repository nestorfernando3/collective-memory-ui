import test from 'node:test';
import assert from 'node:assert/strict';
import { joinBasePath } from './resourcePath.js';

test('joins relative public resources against a root-relative base', () => {
  assert.equal(joinBasePath('./', 'data/profile.json'), './data/profile.json');
});

test('joins relative public resources against a project subpath base', () => {
  assert.equal(
    joinBasePath('/collective-memory-ui/', 'data/projects_index.json'),
    '/collective-memory-ui/data/projects_index.json',
  );
});

test('does not duplicate slashes when the resource path already starts with one', () => {
  assert.equal(joinBasePath('/collective-memory-ui/', '/data/connections.json'), '/collective-memory-ui/data/connections.json');
});
