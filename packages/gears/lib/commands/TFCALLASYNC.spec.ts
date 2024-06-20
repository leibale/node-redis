import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import { GEAR_FUNCTION } from './index.spec';
import TFCALLASYNC from './TFCALLASYNC';

describe('TFCALLASYNC', () => {
    testUtils.isVersionGreaterThanHook([7]);

    it('transformArguments', () => {
        assert.deepEqual(
            TFCALLASYNC.transformArguments('function', {
                keys: ['key'],
                arguments: ['argument']
            }),
            ['TFCALLASYNC', 'function', '1', 'key', 'argument']
        );
    });

    testUtils.testWithClient('client.gears.tFCallAsync', async client => {
        assert.equal(
            await client.gears.tFunctionLoad(
                GEAR_FUNCTION.code,
                { REPLACE: true }
            ),
            'OK'
        );

        assert.equal(
            await client.gears.tFCallAsync(GEAR_FUNCTION.library.foo.NAME),
            'bar'            
        );
    }, GLOBAL.SERVERS.OPEN);
});
