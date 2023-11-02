import { strict as assert } from 'node:assert';
import testUtils, { GLOBAL, waitTillBeenCalled } from '../test-utils';
import RedisClient, { RedisClientType } from '.';
// import { RedisClientMultiCommandType } from './multi-command';
// import { RedisCommandRawReply, RedisModules, RedisFunctions, RedisScripts } from '../commands';
import { AbortError, ClientClosedError, ClientOfflineError, ConnectionTimeoutError, DisconnectsClientError, SocketClosedUnexpectedlyError, WatchError } from '../errors';
import { defineScript } from '../lua-script';
// import { spy } from 'sinon';
import { once } from 'node:events';
// import { ClientKillFilters } from '../commands/CLIENT_KILL';
// import { promisify } from 'node:util';
import { MATH_FUNCTION, loadMathFunction } from '../commands/FUNCTION_LOAD.spec';
import { RESP_TYPES } from '../RESP/decoder';
import { NumberReply } from '../RESP/types';
import { SortedSetMember } from '../commands/generic-transformers';

import {version} from '../../package.json';

export const SQUARE_SCRIPT = defineScript({
  SCRIPT:
    `local number = redis.call('GET', KEYS[1])
    return number * number`,
  NUMBER_OF_KEYS: 1,
  FIRST_KEY_INDEX: 0,
  transformArguments(key: string) {
    return [key];
  },
  transformReply: undefined as unknown as () => NumberReply
});

describe('Client', () => {
  describe('parseURL', () => {
    it('redis://user:secret@localhost:6379/0', () => {
      assert.deepEqual(
        RedisClient.parseURL('redis://user:secret@localhost:6379/0'),
        {
          socket: {
            host: 'localhost',
            port: 6379
          },
          username: 'user',
          password: 'secret',
          database: 0
        }
      );
    });

    it('rediss://user:secret@localhost:6379/0', () => {
      assert.deepEqual(
        RedisClient.parseURL('rediss://user:secret@localhost:6379/0'),
        {
          socket: {
            host: 'localhost',
            port: 6379,
            tls: true
          },
          username: 'user',
          password: 'secret',
          database: 0
        }
      );
    });

    it('Invalid protocol', () => {
      assert.throws(
        () => RedisClient.parseURL('redi://user:secret@localhost:6379/0'),
        TypeError
      );
    });

    it('Invalid pathname', () => {
      assert.throws(
        () => RedisClient.parseURL('redis://user:secret@localhost:6379/NaN'),
        TypeError
      );
    });

    it('redis://localhost', () => {
      assert.deepEqual(
        RedisClient.parseURL('redis://localhost'),
        {
          socket: {
            host: 'localhost',
          }
        }
      );
    });
  });

  describe('authentication', () => {
    testUtils.testWithClient('Client should be authenticated', async client => {
      assert.equal(
        await client.ping(),
        'PONG'
      );
    }, GLOBAL.SERVERS.PASSWORD);

    testUtils.testWithClient('should execute AUTH before SELECT', async client => {
      assert.equal(
        (await client.clientInfo()).db,
        2
      );
    }, {
      ...GLOBAL.SERVERS.PASSWORD,
      clientOptions: {
        ...GLOBAL.SERVERS.PASSWORD.clientOptions,
        database: 2
      },
      minimumDockerVersion: [6, 2]
    });
  });

  testUtils.testWithClient('should set connection name', async client => {
    assert.equal(
      await client.clientGetName(),
      'name'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    clientOptions: {
      name: 'name'
    }
  });

  testUtils.testWithClient('should set default lib name and version', async client => {
    const clientInfo = await client.clientInfo();

    assert.equal(clientInfo.libName, 'node-redis');
    assert.equal(clientInfo.libVer, version);
  }, {
    ...GLOBAL.SERVERS.PASSWORD,
    minimumDockerVersion: [7, 2]
  });

  testUtils.testWithClient('disable sending lib name and version', async client => {
    const clientInfo = await client.clientInfo();

    assert.equal(clientInfo.libName, '');
    assert.equal(clientInfo.libVer, '');
  }, {
    ...GLOBAL.SERVERS.PASSWORD,
    clientOptions: {
      ...GLOBAL.SERVERS.PASSWORD.clientOptions,
      disableClientInfo: true
    },
    minimumDockerVersion: [7, 2]
  });

  testUtils.testWithClient('send client name tag', async client => {
    const clientInfo = await client.clientInfo();

    assert.equal(clientInfo.libName, 'node-redis(test)');
    assert.equal(clientInfo.libVer, version);
  }, {
    ...GLOBAL.SERVERS.PASSWORD,
    clientOptions: {
      ...GLOBAL.SERVERS.PASSWORD.clientOptions,
      clientInfoTag: "test"
    },
    minimumDockerVersion: [7, 2]
  });

  testUtils.testWithClient('connect, ready and end events', async client => {
    await Promise.all([
      once(client, 'connect'),
      once(client, 'ready'),
      client.connect()
    ]);

    await Promise.all([
      once(client, 'end'),
      client.close()
    ]);
  }, {
    ...GLOBAL.SERVERS.OPEN,
    disableClientSetup: true
  });

  describe('sendCommand', () => {
    testUtils.testWithClient('PING', async client => {
      assert.equal(await client.sendCommand(['PING']), 'PONG');
    }, GLOBAL.SERVERS.OPEN);

    describe('AbortController', () => {
      before(function () {
        if (!global.AbortController) {
          this.skip();
        }
      });

      testUtils.testWithClient('success', async client => {
        await client.sendCommand(['PING'], {
          abortSignal: new AbortController().signal
        });
      }, GLOBAL.SERVERS.OPEN);

      testUtils.testWithClient('AbortError', client => {
        const controller = new AbortController();
        controller.abort();

        return assert.rejects(
          client.sendCommand(['PING'], {
            abortSignal: controller.signal
          }),
          AbortError
        );
      }, GLOBAL.SERVERS.OPEN);
    });

    testUtils.testWithClient('undefined and null should not break the client', async client => {
      await assert.rejects(
        client.sendCommand([null as any, undefined as any]),
        TypeError
      );

      assert.equal(
        await client.ping(),
        'PONG'
      );
    }, GLOBAL.SERVERS.OPEN);
  });

  describe('multi', () => {
    testUtils.testWithClient('simple', async client => {
      assert.deepEqual(
        await client.multi()
          .ping()
          .set('key', 'value')
          .get('key')
          .exec(),
        ['PONG', 'OK', 'value']
      );
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('should reject the whole chain on error', client => {
      return assert.rejects(
        client.multi()
          .ping()
          .addCommand(['INVALID COMMAND'])
          .ping()
          .exec()
      );
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('should reject the whole chain upon client disconnect', async client => {
      await client.close();

      return assert.rejects(
        client.multi()
          .ping()
          .set('key', 'value')
          .get('key')
          .exec(),
        ClientClosedError
      );
    }, GLOBAL.SERVERS.OPEN);

    testUtils.testWithClient('with script', async client => {
      assert.deepEqual(
        await client.multi()
          .set('key', '2')
          .square('key')
          .exec(),
        ['OK', 4]
      );
    }, {
      ...GLOBAL.SERVERS.OPEN,
      clientOptions: {
        scripts: {
          square: SQUARE_SCRIPT
        }
      }
    });

    // testUtils.testWithClient('WatchError', async client => {
    //   await client.watch('key');

    //   await client.set(
    //     RedisClient.commandOptions({
    //       isolated: true
    //     }),
    //     'key',
    //     '1'
    //   );

    //   await assert.rejects(
    //     client.multi()
    //       .decr('key')
    //       .exec(),
    //     WatchError
    //   );
    // }, GLOBAL.SERVERS.OPEN);

    describe('execAsPipeline', () => {
      testUtils.testWithClient('exec(true)', async client => {
        assert.deepEqual(
          await client.multi()
            .ping()
            .exec(true),
          ['PONG']
        );
      }, GLOBAL.SERVERS.OPEN);

      testUtils.testWithClient('empty execAsPipeline', async client => {
        assert.deepEqual(
          await client.multi().execAsPipeline(),
          []
        );
      }, GLOBAL.SERVERS.OPEN);
    });

    // testUtils.testWithClient('should remember selected db', async client => {
    //   await client.multi()
    //     .select(1)
    //     .exec();
    //   await killClient(client);
    //   assert.equal(
    //     (await client.clientInfo()).db,
    //     1
    //   );
    // }, {
    //   ...GLOBAL.SERVERS.OPEN,
    //   minimumDockerVersion: [6, 2] // CLIENT INFO
    // });
  });

  testUtils.testWithClient('scripts', async client => {
    const [, reply] = await Promise.all([
      client.set('key', '2'),
      client.square('key')
    ]);

    assert.equal(reply, 4);
  }, {
    ...GLOBAL.SERVERS.OPEN,
    clientOptions: {
      scripts: {
        square: SQUARE_SCRIPT
      }
    }
  });

  const module = {
    echo: {
      transformArguments(message: string): Array<string> {
        return ['ECHO', message];
      },
      transformReply(reply: string): string {
        return reply;
      }
    }
  };

  testUtils.testWithClient('modules', async client => {
    assert.equal(
      await client.module.echo('message'),
      'message'
    );
  }, {
    ...GLOBAL.SERVERS.OPEN,
    clientOptions: {
      modules: {
        module
      }
    }
  });

  testUtils.testWithClient('functions', async client => {
    const [,, reply] = await Promise.all([
      loadMathFunction(client),
      client.set('key', '2'),
      client.math.square('key')
    ]);

    assert.equal(reply, 4);
  }, {
    ...GLOBAL.SERVERS.OPEN,
    minimumDockerVersion: [7, 0],
    clientOptions: {
      functions: {
        math: MATH_FUNCTION.library
      }
    }
  });

  testUtils.testWithClient('duplicate should reuse command options', async client => {
    const duplicate = client.duplicate();

    await duplicate.connect();

    try {
      assert.deepEqual(
        await duplicate.ping(),
        Buffer.from('PONG')
      );
    } finally {
      duplicate.close();
    }
  }, {
    ...GLOBAL.SERVERS.OPEN,
    clientOptions: {
      commandOptions: {
        typeMapping: {
          [RESP_TYPES.SIMPLE_STRING]: Buffer
        }
      }
    },
    disableClientSetup: true,
  });

//   describe('isolationPool', () => {
//     testUtils.testWithClient('executeIsolated', async client => {
//       const id = await client.clientId(),
//         isolatedId = await client.executeIsolated(isolatedClient => isolatedClient.clientId());
//       assert.ok(id !== isolatedId);
//     }, GLOBAL.SERVERS.OPEN);

//     testUtils.testWithClient('should be able to use pool even before connect', async client => {
//       await client.executeIsolated(() => Promise.resolve());
//       // make sure to destroy isolation pool
//       await client.connect();
//       await client.disconnect();
//     }, {
//       ...GLOBAL.SERVERS.OPEN,
//       disableClientSetup: true
//     });

//     testUtils.testWithClient('should work after reconnect (#2406)', async client => {
//       await client.disconnect();
//       await client.connect();
//       await client.executeIsolated(() => Promise.resolve());
//     }, GLOBAL.SERVERS.OPEN);

//     testUtils.testWithClient('should throw ClientClosedError after disconnect', async client => {
//       await client.connect();
//       await client.disconnect();
//       await assert.rejects(
//         client.executeIsolated(() => Promise.resolve()),
//         ClientClosedError
//       );
//     }, {
//       ...GLOBAL.SERVERS.OPEN,
//       disableClientSetup: true
//     });
//   });

//   async function killClient<
//     M extends RedisModules,
//     F extends RedisFunctions,
//     S extends RedisScripts
//   >(
//     client: RedisClientType<M, F, S>,
//     errorClient: RedisClientType<M, F, S> = client
//   ): Promise<void> {
//     const onceErrorPromise = once(errorClient, 'error');
//     await client.sendCommand(['QUIT']);
//     await Promise.all([
//       onceErrorPromise,
//       assert.rejects(client.ping(), SocketClosedUnexpectedlyError)
//     ]);
//   }

//   testUtils.testWithClient('should reconnect when socket disconnects', async client => {
//     await killClient(client);
//     await assert.doesNotReject(client.ping());
//   }, GLOBAL.SERVERS.OPEN);

//   testUtils.testWithClient('should remember selected db', async client => {
//     await client.select(1);
//     await killClient(client);
//     assert.equal(
//       (await client.clientInfo()).db,
//       1
//     );
//   }, {
//     ...GLOBAL.SERVERS.OPEN,
//     minimumDockerVersion: [6, 2] // CLIENT INFO
//   });

//   testUtils.testWithClient('should propagated errors from "isolated" clients', client => {
//     client.on('error', () => {
//       // ignore errors
//     });
//     return client.executeIsolated(isolated => killClient(isolated, client));
//   }, GLOBAL.SERVERS.OPEN);

  testUtils.testWithClient('scanIterator', async client => {
    const entries: Array<string> = [],
      keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const key = i.toString();
      keys.add(key);
      entries.push(key, '');
    }

    await client.mSet(entries);

    const results = new Set();
    for await (const keys of client.scanIterator()) {
      for (const key of keys) {
        results.add(key);
      }
    }

    assert.deepEqual(keys, results);
  }, GLOBAL.SERVERS.OPEN);

  testUtils.testWithClient('hScanIterator', async client => {
    const hash: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      hash[i.toString()] = i.toString();
    }

    await client.hSet('key', hash);

    const results: Record<string, string> = {};
    for await (const entries of client.hScanIterator('key')) {
      for (const { field, value } of entries) {
        results[field] = value;
      }
    }

    assert.deepEqual(hash, results);
  }, GLOBAL.SERVERS.OPEN);

  testUtils.testWithClient('sScanIterator', async client => {
    const members = new Set<string>();
    for (let i = 0; i < 100; i++) {
      members.add(i.toString());
    }

    await client.sAdd('key', Array.from(members));

    const results = new Set<string>();
    for await (const members of client.sScanIterator('key')) {
      for (const member of members) {
        results.add(member);
      }
    }

    assert.deepEqual(members, results);
  }, GLOBAL.SERVERS.OPEN);

  testUtils.testWithClient('zScanIterator', async client => {
    const members: Array<SortedSetMember> = [],
      map = new Map<string, number>();
    for (let i = 0; i < 100; i++) {
      const member = {
        value: i.toString(),
        score: 1
      };
      map.set(member.value, member.score);
      members.push(member);
    }

    await client.zAdd('key', members);

    const results = new Map<string, number>();
    for await (const members of client.zScanIterator('key')) {
      for (const { value, score } of members) {
        results.set(value, score);
      }
    }

    assert.deepEqual(map, results);
  }, GLOBAL.SERVERS.OPEN);

//   describe('PubSub', () => {
//     testUtils.testWithClient('should be able to publish and subscribe to messages', async publisher => {
//       function assertStringListener(message: string, channel: string) {
//         assert.equal(typeof message, 'string');
//         assert.equal(typeof channel, 'string');
//       }

//       function assertBufferListener(message: Buffer, channel: Buffer) {
//         assert.ok(message instanceof Buffer);
//         assert.ok(channel instanceof Buffer);
//       }

//       const subscriber = publisher.duplicate();

//       await subscriber.connect();

//       try {
//         const channelListener1 = spy(assertBufferListener),
//           channelListener2 = spy(assertStringListener),
//           patternListener = spy(assertStringListener);

//         await Promise.all([
//           subscriber.subscribe('channel', channelListener1, true),
//           subscriber.subscribe('channel', channelListener2),
//           subscriber.pSubscribe('channel*', patternListener)
//         ]);
//         await Promise.all([
//           waitTillBeenCalled(channelListener1),
//           waitTillBeenCalled(channelListener2),
//           waitTillBeenCalled(patternListener),
//           publisher.publish(Buffer.from('channel'), Buffer.from('message'))
//         ]);

//         assert.ok(channelListener1.calledOnceWithExactly(Buffer.from('message'), Buffer.from('channel')));
//         assert.ok(channelListener2.calledOnceWithExactly('message', 'channel'));
//         assert.ok(patternListener.calledOnceWithExactly('message', 'channel'));

//         await subscriber.unsubscribe('channel', channelListener1, true);
//         await Promise.all([
//           waitTillBeenCalled(channelListener2),
//           waitTillBeenCalled(patternListener),
//           publisher.publish('channel', 'message')
//         ]);
//         assert.ok(channelListener1.calledOnce);
//         assert.ok(channelListener2.calledTwice);
//         assert.ok(channelListener2.secondCall.calledWithExactly('message', 'channel'));
//         assert.ok(patternListener.calledTwice);
//         assert.ok(patternListener.secondCall.calledWithExactly('message', 'channel'));
//         await subscriber.unsubscribe('channel');
//         await Promise.all([
//           waitTillBeenCalled(patternListener),
//           publisher.publish('channel', 'message')
//         ]);
//         assert.ok(channelListener1.calledOnce);
//         assert.ok(channelListener2.calledTwice);
//         assert.ok(patternListener.calledThrice);
//         assert.ok(patternListener.thirdCall.calledWithExactly('message', 'channel'));
//         await subscriber.pUnsubscribe();
//         await publisher.publish('channel', 'message');
//         assert.ok(channelListener1.calledOnce);
//         assert.ok(channelListener2.calledTwice);
//         assert.ok(patternListener.calledThrice);
//         // should be able to send commands when unsubsribed from all channels (see #1652)
//         await assert.doesNotReject(subscriber.ping());
//       } finally {
//         await subscriber.disconnect();
//       }
//     }, GLOBAL.SERVERS.OPEN);

//     testUtils.testWithClient('should resubscribe', async publisher => {
//       const subscriber = publisher.duplicate();

//       await subscriber.connect();

//       try {
//         const channelListener = spy();
//         await subscriber.subscribe('channel', channelListener);

//         const patternListener = spy();
//         await subscriber.pSubscribe('channe*', patternListener);

//         await Promise.all([
//           once(subscriber, 'error'),
//           publisher.clientKill({
//             filter: ClientKillFilters.SKIP_ME,
//             skipMe: true
//           })
//         ]);

//         await once(subscriber, 'ready');

//         await Promise.all([
//           waitTillBeenCalled(channelListener),
//           waitTillBeenCalled(patternListener),
//           publisher.publish('channel', 'message')
//         ]);
//       } finally {
//         await subscriber.disconnect();
//       }
//     }, GLOBAL.SERVERS.OPEN);

//     testUtils.testWithClient('should not fail when message arrives right after subscribe', async publisher => {
//       const subscriber = publisher.duplicate();

//       await subscriber.connect();

//       try {
//         await assert.doesNotReject(Promise.all([
//           subscriber.subscribe('channel', () => {
//             // noop
//           }),
//           publisher.publish('channel', 'message')
//         ]));
//       } finally {
//         await subscriber.disconnect();
//       }
//     }, GLOBAL.SERVERS.OPEN);

//     testUtils.testWithClient('should be able to quit in PubSub mode', async client => {
//       await client.subscribe('channel', () => {
//         // noop
//       });

//       await assert.doesNotReject(client.quit());

//       assert.equal(client.isOpen, false);
//     }, GLOBAL.SERVERS.OPEN);
//   });

//   testUtils.testWithClient('ConnectionTimeoutError', async client => {
//     const promise = assert.rejects(client.connect(), ConnectionTimeoutError),
//       start = process.hrtime.bigint();

//     while (process.hrtime.bigint() - start < 1_000_000) {
//       // block the event loop for 1ms, to make sure the connection will timeout
//     }

//     await promise;
//   }, {
//     ...GLOBAL.SERVERS.OPEN,
//     clientOptions: {
//       socket: {
//         connectTimeout: 1
//       }
//     },
//     disableClientSetup: true
//   });

//   testUtils.testWithClient('client.quit', async client => {
//     await client.connect();

//     const pingPromise = client.ping(),
//       quitPromise = client.quit();
//     assert.equal(client.isOpen, false);

//     const [ping, quit] = await Promise.all([
//       pingPromise,
//       quitPromise,
//       assert.rejects(client.ping(), ClientClosedError)
//     ]);

//     assert.equal(ping, 'PONG');
//     assert.equal(quit, 'OK');
//   }, {
//     ...GLOBAL.SERVERS.OPEN,
//     disableClientSetup: true
//   });

//   testUtils.testWithClient('client.disconnect', async client => {
//     const pingPromise = client.ping(),
//       disconnectPromise = client.disconnect();
//     assert.equal(client.isOpen, false);
//     await Promise.all([
//       assert.rejects(pingPromise, DisconnectsClientError),
//       assert.doesNotReject(disconnectPromise),
//       assert.rejects(client.ping(), ClientClosedError)
//     ]);
//   }, GLOBAL.SERVERS.OPEN);

//   testUtils.testWithClient('should be able to connect after disconnect (see #1801)', async client => {
//     await client.disconnect();
//     await client.connect();
//   }, GLOBAL.SERVERS.OPEN);

//   testUtils.testWithClient('should be able to use ref and unref', client => {
//     client.unref();
//     client.ref();
//   }, GLOBAL.SERVERS.OPEN);

//   testUtils.testWithClient('pingInterval', async client => {
//     assert.deepEqual(
//       await once(client, 'ping-interval'),
//       ['PONG']
//     );
//   }, {
//     ...GLOBAL.SERVERS.OPEN,
//     clientOptions: {
//       pingInterval: 1
//     }
//   });

//   testUtils.testWithClient('should reject commands in connect phase when `disableOfflineQueue`', async client => {
//     const connectPromise = client.connect();
//     await assert.rejects(
//       client.ping(),
//       ClientOfflineError
//     );
//     await connectPromise;
//     await client.disconnect();
//   }, {
//     ...GLOBAL.SERVERS.OPEN,
//     clientOptions: {
//       disableOfflineQueue: true
//     },
//     disableClientSetup: true
//   });
});
