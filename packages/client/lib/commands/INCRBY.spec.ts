import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import INCRBY from './INCRBY';

describe('INCRBY', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      INCRBY.transformArguments('key', 1),
      ['INCRBY', 'key', '1']
    );
  });

  testUtils.testAll('incrBy', async client => {
    assert.equal(
      await client.incrBy('key', 1),
      1
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
