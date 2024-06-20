import { RedisArgument, CommandArguments, BlobStringReply, Command } from '@redis/client/dist/lib/RESP/types';

export default {
    FIRST_KEY_INDEX: undefined,
    IS_READ_ONLY: false,
    transformArguments(library: RedisArgument){
        const args: CommandArguments = ['TFUNCTION', 'DELETE'];

        args.push(library);

        return args;
    },
    transformReply: undefined as unknown as () => BlobStringReply
} as const satisfies Command;
