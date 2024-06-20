import { strict as assert } from 'assert';
import testUtils, { GLOBAL } from '../test-utils';
import { GEAR_FUNCTION } from './index.spec';
import TFUNCTION_LOAD from './TFUNCTION_LOAD';

describe('TFUNCTION LOAD', () => {
    testUtils.isVersionGreaterThanHook([7]);

    describe('transformArguments', () => {
        it('simple', () => {
            assert.deepEqual(
                TFUNCTION_LOAD.transformArguments( 'code'),
                ['TFUNCTION', 'LOAD', 'code']
            );
        });

        it('with REPLACE', () => {
            assert.deepEqual(
                TFUNCTION_LOAD.transformArguments('code', {
                    REPLACE: true
                }),
                ['TFUNCTION', 'LOAD', 'REPLACE', 'code']
            );
        });

        it('with CONFIG', () => {
            assert.deepEqual(
                TFUNCTION_LOAD.transformArguments('code', {
                    CONFIG: 'Hello'
                }),
                ['TFUNCTION', 'LOAD', 'CONFIG', 'Hello', 'code']
            );
        });
    });

    testUtils.testWithClient('client.gears.tFunctionLoad', async client => {
        assert.equal(
            await client.gears.tFunctionLoad(
                GEAR_FUNCTION.code,
                { REPLACE: true }
            ),
            'OK'
        );
        var x = await client.sendCommand(["TFUNCTION", "LIST"])
        assert.equal(x[0][9][0], 'foo')
        assert.equal(x[0][13], 'lib1')

        assert.equal(
            await client.sendCommand(["TFCALL", GEAR_FUNCTION.library.foo.NAME, "0"]),
            "bar"
        );
    }, GLOBAL.SERVERS.OPEN);
});
