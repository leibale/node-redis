import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import ZREMRANGEBYRANK from './ZREMRANGEBYRANK';

describe('ZREMRANGEBYRANK', () => {
  it('transformArguments', () => {
    assert.deepEqual(
      ZREMRANGEBYRANK.transformArguments('key', 0, 1),
      ['ZREMRANGEBYRANK', 'key', '0', '1']
    );
  });

  testUtils.testAll('zRemRangeByRank', async client => {
    assert.equal(
      await client.zRemRangeByRank('key', 0, 1),
      0
    );
  }, {
    client: GLOBAL.SERVERS.OPEN,
    cluster: GLOBAL.CLUSTERS.OPEN
  });
});
