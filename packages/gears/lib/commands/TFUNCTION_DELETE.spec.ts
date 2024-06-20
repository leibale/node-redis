import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import {GEAR_ASYNC_FUNCTION } from './index.spec';
import TFUNCTION_DELETE from './TFUNCTION_DELETE';

describe('TFUNCTION DELETE', () => {
    testUtils.isVersionGreaterThanHook([7]);

    describe('transformArguments', () => {
        it('simple', () => {
            assert.deepEqual(
                TFUNCTION_DELETE.transformArguments( 'library'),
                ['TFUNCTION', 'DELETE', 'library']
            );
        });
    });

    testUtils.testWithClient('client.gears.tFunctionDelete', async client => {
        assert.equal(
            await client.gears.tFunctionLoad(
                GEAR_ASYNC_FUNCTION.code,
                { REPLACE: true }
            ),
            'OK'
        );
        let x = await client.sendCommand(["TFUNCTION", "LIST"])
        assert.equal(x[0][9][0], 'asyncFoo')
        assert.equal(x[0][13], 'lib1')

        assert.equal(
            await client.gears.tFunctionDelete(GEAR_ASYNC_FUNCTION.library.NAME),
            'OK'
        );

        x = await client.sendCommand(["TFUNCTION", "LIST"])
        assert.equal(x.length, 0)
    }, GLOBAL.SERVERS.OPEN);
});
