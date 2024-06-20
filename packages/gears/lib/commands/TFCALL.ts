import { RedisArgument, CommandArguments, BlobStringReply, Command } from '@redis/client/dist/lib/RESP/types';
import {TFunctionLoadOptions} from "./TFUNCTION_LOAD";

export interface TFCallOptions {
    keys?: Array<string>;
    arguments?: Array<string>;
}

export function firstKeyIndex(options?: TFCallOptions): string | undefined {
    return options?.keys?.[0];
}

export function pushEvalArguments(args: Array<string>, options?: TFCallOptions): Array<string> {
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

export default {
    FIRST_KEY_INDEX: firstKeyIndex,
    IS_READ_ONLY: false,
    transformArguments(fn: string, options?: TFCallOptions): Array<string> {
        return pushEvalArguments(['TFCALL', fn], options);
    },
    transformReply: undefined as unknown as () => BlobStringReply
} as const satisfies Command;
