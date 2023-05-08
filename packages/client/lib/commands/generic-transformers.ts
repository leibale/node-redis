import { ArrayReply, BlobStringReply, CommandArguments, DoubleReply, NullReply, RedisArgument, Resp2Reply } from '../RESP/types';

// export function transformBooleanReply(reply: number): boolean {
//     return reply === 1;
// }

// export function transformBooleanArrayReply(reply: Array<number>): Array<boolean> {
//     return reply.map(transformBooleanReply);
// }

export type BitValue = 0 | 1;

export function transformDoubleReply(reply: BlobStringReply): number {
  switch (reply.toString()) {
    case '+inf':
      return Infinity;

    case '-inf':
      return -Infinity;

    default:
      return Number(reply);
  }
}

export function transformNullableDoubleReply(reply: BlobStringReply | NullReply): number | null {
  if (reply === null) return null;

  return transformDoubleReply(reply);
}

export function transformArrayNullableDoubleReply(reply: Array<BlobStringReply | NullReply>): Array<number | null> {
  return reply.map(transformNullableDoubleReply);
}

export function transformDoubleArgument(num: number): string {
  switch (num) {
    case Infinity:
      return '+inf';

    case -Infinity:
      return '-inf';

    default:
      return num.toString();
  }
}

export function transformStringDoubleArgument(num: RedisArgument | number): RedisArgument {
  if (typeof num !== 'number') return num;

  return transformDoubleArgument(num);
}

export function transformTuplesReply(
  reply: ArrayReply<BlobStringReply>
): Record<string, BlobStringReply> {
  const message = Object.create(null);

  for (let i = 0; i < reply.length; i += 2) {
    message[reply[i].toString()] = reply[i + 1];
  }

  return message;
}

export interface StreamMessageReply {
  id: RedisArgument;
  message: Record<string, RedisArgument>;
}

export type StreamMessagesReply = Array<StreamMessageReply>;

export function transformStreamMessagesReply(reply: Array<any>): StreamMessagesReply {
  const messages = [];

  for (const [id, message] of reply) {
    messages.push({
      id,
      message: transformTuplesReply(message)
    });
  }

  return messages;
}

export type StreamsMessagesReply = Array<{
  name: RedisArgument;
  messages: StreamMessagesReply;
}> | null;

export function transformStreamsMessagesReply(reply: Array<any> | null): StreamsMessagesReply | null {
  if (reply === null) return null;

  return reply.map(([name, rawMessages]) => ({
    name,
    messages: transformStreamMessagesReply(rawMessages)
  }));
}

export interface ZMember {
  score: number;
  value: RedisArgument;
}

export function transformSortedSetMemberNullReply(
  reply: [BlobStringReply, BlobStringReply] | []
): ZMember | null {
  if (!reply.length) return null;

  return transformSortedSetMemberReply(reply);
}

export function transformSortedSetMemberReply(
  reply: [BlobStringReply, BlobStringReply]
): ZMember {
  return {
    value: reply[0],
    score: transformDoubleReply(reply[1])
  };
}

export const transformSortedSetReply = {
  2: (reply: ArrayReply<BlobStringReply>) => {
    const members = [];
    for (let i = 0; i < reply.length; i += 2) {
      members.push({
        value: reply[i],
        score: transformDoubleReply(reply[i + 1])
      });
    }

    return members;
  },
  3: (reply: ArrayReply<[BlobStringReply, DoubleReply]>) => {
    return reply.map(([value, score]) => ({
      value,
      score
    }));
  }
}

export function transformSortedSetWithScoresReply(reply: ArrayReply<BlobStringReply>): Array<ZMember> {
  const members = [];

  for (let i = 0; i < reply.length; i += 2) {
    members.push({
      value: reply[i],
      score: transformDoubleReply(reply[i + 1])
    });
  }

  return members;
}

export type ListSide = 'LEFT' | 'RIGHT';

export type SortedSetSide = 'MIN' | 'MAX';

export interface LMPopOptions {
  COUNT?: number;
}

export function transformLMPopArguments(
  args: CommandArguments,
  keys: RedisVariadicArgument,
  side: ListSide,
  options?: LMPopOptions
): CommandArguments {
  pushVariadicArgument(args, keys);

  args.push(side);

  if (options?.COUNT) {
    args.push('COUNT', options.COUNT.toString());
  }

  return args;
}

export function transformEXAT(EXAT: number | Date): string {
  return (typeof EXAT === 'number' ? EXAT : Math.floor(EXAT.getTime() / 1000)).toString();
}

export function transformPXAT(PXAT: number | Date): string {
  return (typeof PXAT === 'number' ? PXAT : PXAT.getTime()).toString();
}

export interface EvalOptions {
  keys?: Array<string>;
  arguments?: Array<string>;
}

export function evalFirstKeyIndex(options?: EvalOptions): string | undefined {
  return options?.keys?.[0];
}

export function pushEvalArguments(args: Array<string>, options?: EvalOptions): Array<string> {
  if (options?.keys) {
    args.push(
      options.keys.length.toString(),
      ...options.keys
    );
  } else {
    args.push('0');
  }

  if (options?.arguments) {
    args.push(...options.arguments);
  }

  return args;
}

export function pushVariadicArguments(args: CommandArguments, value: RedisVariadicArgument): CommandArguments {
  if (Array.isArray(value)) {
    // https://github.com/redis/node-redis/pull/2160
    args = args.concat(value);
  } else {
    args.push(value);
  }

  return args;
}

export function pushVariadicNumberArguments(
  args: CommandArguments,
  value: number | Array<number>
): CommandArguments {
  if (Array.isArray(value)) {
    for (const item of value) {
      args.push(item.toString());
    }
  } else {
    args.push(value.toString());
  }

  return args;
}

export type RedisVariadicArgument = RedisArgument | Array<RedisArgument>;

export function pushVariadicArgument(
  args: Array<RedisArgument>,
  value: RedisVariadicArgument
): CommandArguments {
  if (Array.isArray(value)) {
    args.push(value.length.toString(), ...value);
  } else {
    args.push('1', value);
  }

  return args;
}

export function pushOptionalVariadicArgument(
  args: CommandArguments,
  name: RedisArgument,
  value?: RedisVariadicArgument
): CommandArguments {
  if (value === undefined) return args;

  args.push(name);

  return pushVariadicArgument(args, value);
}

export enum CommandFlags {
  WRITE = 'write', // command may result in modifications
  READONLY = 'readonly', // command will never modify keys
  DENYOOM = 'denyoom', // reject command if currently out of memory
  ADMIN = 'admin', // server admin command
  PUBSUB = 'pubsub', // pubsub-related command
  NOSCRIPT = 'noscript', // deny this command from scripts
  RANDOM = 'random', // command has random results, dangerous for scripts
  SORT_FOR_SCRIPT = 'sort_for_script', // if called from script, sort output
  LOADING = 'loading', // allow command while database is loading
  STALE = 'stale', // allow command while replica has stale data
  SKIP_MONITOR = 'skip_monitor', // do not show this command in MONITOR
  ASKING = 'asking', // cluster related - accept even if importing
  FAST = 'fast', // command operates in constant or log(N) time. Used for latency monitoring.
  MOVABLEKEYS = 'movablekeys' // keys have no pre-determined position. You must discover keys yourself.
}

export enum CommandCategories {
  KEYSPACE = '@keyspace',
  READ = '@read',
  WRITE = '@write',
  SET = '@set',
  SORTEDSET = '@sortedset',
  LIST = '@list',
  HASH = '@hash',
  STRING = '@string',
  BITMAP = '@bitmap',
  HYPERLOGLOG = '@hyperloglog',
  GEO = '@geo',
  STREAM = '@stream',
  PUBSUB = '@pubsub',
  ADMIN = '@admin',
  FAST = '@fast',
  SLOW = '@slow',
  BLOCKING = '@blocking',
  DANGEROUS = '@dangerous',
  CONNECTION = '@connection',
  TRANSACTION = '@transaction',
  SCRIPTING = '@scripting'
}

export type CommandRawReply = [
  name: string,
  arity: number,
  flags: Array<CommandFlags>,
  firstKeyIndex: number,
  lastKeyIndex: number,
  step: number,
  categories: Array<CommandCategories>
];

export type CommandReply = {
  name: string,
  arity: number,
  flags: Set<CommandFlags>,
  firstKeyIndex: number,
  lastKeyIndex: number,
  step: number,
  categories: Set<CommandCategories>
};

export function transformCommandReply(
  this: void,
  [name, arity, flags, firstKeyIndex, lastKeyIndex, step, categories]: CommandRawReply
): CommandReply {
  return {
    name,
    arity,
    flags: new Set(flags),
    firstKeyIndex,
    lastKeyIndex,
    step,
    categories: new Set(categories)
  };
}

export enum RedisFunctionFlags {
  NO_WRITES = 'no-writes',
  ALLOW_OOM = 'allow-oom',
  ALLOW_STALE = 'allow-stale',
  NO_CLUSTER = 'no-cluster'
}

export type FunctionListRawItemReply = [
  'library_name',
  string,
  'engine',
  string,
  'functions',
  Array<[
    'name',
    string,
    'description',
    string | null,
    'flags',
    Array<RedisFunctionFlags>
  ]>
];

export interface FunctionListItemReply {
  libraryName: string;
  engine: string;
  functions: Array<{
    name: string;
    description: string | null;
    flags: Array<RedisFunctionFlags>;
  }>;
}

export function transformFunctionListItemReply(reply: FunctionListRawItemReply): FunctionListItemReply {
  return {
    libraryName: reply[1],
    engine: reply[3],
    functions: reply[5].map(fn => ({
      name: fn[1],
      description: fn[3],
      flags: fn[5]
    }))
  };
}

export interface SlotRange {
  start: number;
  end: number;
}

function pushSlotRangeArguments(
  args: CommandArguments,
  range: SlotRange
): void {
  args.push(
    range.start.toString(),
    range.end.toString()
  );
}

export function pushSlotRangesArguments(
  args: CommandArguments,
  ranges: SlotRange | Array<SlotRange>
): CommandArguments {
  if (Array.isArray(ranges)) {
    for (const range of ranges) {
      pushSlotRangeArguments(args, range);
    }
  } else {
    pushSlotRangeArguments(args, ranges);
  }

  return args;
}

export type RawRangeReply = [
  start: number,
  end: number
];

export interface RangeReply {
  start: number;
  end: number;
}

export function transformRangeReply([start, end]: RawRangeReply): RangeReply {
  return {
    start,
    end
  };
}
