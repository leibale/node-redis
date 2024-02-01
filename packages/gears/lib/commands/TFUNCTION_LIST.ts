import { RedisArgument, TuplesToMapReply, BlobStringReply, ArrayReply, NullReply, SetReply, UnwrapReply, Resp2Reply, CommandArguments, Command, ReplyWithTypeMapping } from '../RESP/types';

export interface TFunctionListOptions {
  LIBRARYNAME?: RedisArgument;
}

export type TFunctionListReplyItem = [
  [BlobStringReply<'library_name'>, BlobStringReply | NullReply],
  [BlobStringReply<'engine'>, BlobStringReply],
  [BlobStringReply<'functions'>, ArrayReply<TuplesToMapReply<[
    [BlobStringReply<'name'>, BlobStringReply],
    [BlobStringReply<'description'>, BlobStringReply | NullReply],
    [BlobStringReply<'flags'>, SetReply<BlobStringReply>],
  ]>>]
];

export type TFunctionListReply = ArrayReply<TuplesToMapReply<TFunctionListReplyItem>>;

export default {
  FIRST_KEY_INDEX: undefined,
  IS_READ_ONLY: false,
  transformArguments(options?: TFunctionListOptions) {
    const args: CommandArguments = ['FUNCTION', 'LIST'];

    if (options?.LIBRARYNAME) {
      args.push('LIBRARYNAME', options.LIBRARYNAME);
    }

    return args;
  },
  transformReply: {
    2: (reply: UnwrapReply<Resp2Reply<TFunctionListReply>>) => {
      return reply.map(library => {
        const unwrapped = library as unknown as UnwrapReply<typeof library>;
        return {
          library_name: unwrapped[1],
          engine: unwrapped[3],
          functions: (unwrapped[5] as unknown as UnwrapReply<typeof unwrapped[5]>).map(fn => {
            const unwrapped = fn as unknown as UnwrapReply<typeof fn>;
            return {
              name: unwrapped[1],
              description: unwrapped[3],
              flags: unwrapped[5]
            };
          })
        };
      });
    },
    3: undefined as unknown as () => TFunctionListReply
  }
} as const satisfies Command;
