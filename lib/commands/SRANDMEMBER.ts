import { transformReplyStringArray } from './generic-transformers';

export const FIRST_KEY_INDEX = 1;

export function transformArguments(key: string, count?: number): Array<string> {
    const args = ['SRANDMEMBER', key];

    if (typeof count === 'number') {
        args.push(count.toString());
    }

    return args;
}

// TODO: without `count` it'll return "bulk string" and not "array"
export const transformReply = transformReplyStringArray;