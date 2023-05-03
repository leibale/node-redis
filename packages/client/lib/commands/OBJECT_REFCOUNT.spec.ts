import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import OBJECT_REFCOUNT from './OBJECT_REFCOUNT';

describe('OBJECT REFCOUNT', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      OBJECT_REFCOUNT.transformArguments('key'),
      ['OBJECT', 'REFCOUNT', 'key']
    );
  });

  testUtils.testAll('client.objectRefCount', async client => {
    assert.equal(
      await client.objectRefCount('key'),
      null
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
