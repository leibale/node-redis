import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import { GEAR_FUNCTION } from './index.spec';
import TFCALL from './TFCALL';

describe('TFCALL', () => {
    testUtils.isVersionGreaterThanHook([7]);

    it('transformArguments', () => {
        assert.deepEqual(
            TFCALL.transformArguments('function', {
                keys: ['key'],
                arguments: ['argument']
            }),
            ['TFCALL', 'function', '1', 'key', 'argument']
        );
    });

    testUtils.testWithClient('client.gears.tfCall', async client => {
        assert.equal(
            await client.gears.tFunctionLoad(
                GEAR_FUNCTION.code,
                { REPLACE: true }
            ),
            'OK'
        );

/*        assert.equal(
            await client.sendCommand(["TFUNCTION", "LIST"]),
            "shayapotter"
        );
 */

        assert.equal(
            await client.gears.tFCall(GEAR_FUNCTION.library.foo.NAME),
            'bar'            
        );
    }, GLOBAL.SERVERS.OPEN);
});
