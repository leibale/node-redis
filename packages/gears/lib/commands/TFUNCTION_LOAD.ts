import { RedisArgument, CommandArguments, BlobStringReply, Command } from '@redis/client/dist/lib/RESP/types';

export interface TFunctionLoadOptions {
    REPLACE?: boolean;
    CONFIG?: string;
}

export default {
    FIRST_KEY_INDEX: undefined,
    IS_READ_ONLY: false,
    transformArguments(code: RedisArgument, options?: TFunctionLoadOptions){
        const args: CommandArguments = ['TFUNCTION', 'LOAD'];

        if (options?.REPLACE) {
            args.push('REPLACE');
        }

        if (options?.CONFIG) {
            args.push('CONFIG')
            args.push(options.CONFIG)
        }

        args.push(code);

        return args;
    },
    transformReply: undefined as unknown as () => BlobStringReply
} as const satisfies Command;
