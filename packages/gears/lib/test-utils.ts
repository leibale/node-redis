import TestUtils from '@redis/test-utils';
import RedisGears from '.';

export default new TestUtils({
    dockerImageName: 'redis/redis-stack-server',
    dockerImageVersionArgument: 'redis-stack-server-version',
    defaultDockerVersion: 'edge'
});

export const GLOBAL = {
    SERVERS: {
        OPEN: {
            serverArguments: ['--loadmodule /opt/redis-stack/lib/redisgears.so v8-plugin-path /opt/redis-stack/lib/libredisgears_v8_plugin.so'],
            clientOptions: {
                modules: {
                    gears: RedisGears
                }
            }
        }
    }
};
