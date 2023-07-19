import { RedisArgument, TuplesReply, BlobStringReply, ArrayReply, NullReply, UnwrapReply, Command } from '../RESP/types';
import { StreamMessageRawReply, isNullReply, transformStreamMessageReply } from './generic-transformers';

export interface XAutoClaimOptions {
  COUNT?: number;
}

export type XAutoClaimRawReply = TuplesReply<[
  nextId: BlobStringReply,
  messages: ArrayReply<StreamMessageRawReply | NullReply>,
  deletedMessages: ArrayReply<BlobStringReply>
]>;

export default {
  FIRST_KEY_INDEX: 1,
  IS_READ_ONLY: false,
  transformArguments(
    key: RedisArgument,
    group: RedisArgument,
    consumer: RedisArgument,
    minIdleTime: number,
    start: RedisArgument,
    options?: XAutoClaimOptions
  ) {
    const args = [
      'XAUTOCLAIM',
      key,
      group,
      consumer,
      minIdleTime.toString(),
      start
    ];

    if (options?.COUNT) {
      args.push('COUNT', options.COUNT.toString());
    }

    return args;
  },
  transformReply(reply: UnwrapReply<XAutoClaimRawReply>) {
    return {
      nextId: reply[0],
      messages: (reply[1] as unknown as UnwrapReply<typeof reply[1]>).map(message => {
        return isNullReply(message) ? null : transformStreamMessageReply(message);
      }),
      deletedMessages: reply[2]
    };
  }
} as const satisfies Command;
