import { RedisCommandArguments } from '@redis/client/dist/lib/commands';
import * as ADD from './ADD';
export type { ADD };
import * as BYRANK from './BYRANK';
export type { BYRANK };
import * as BYREVRANK from './BYREVRANK';
export type { BYREVRANK };
import * as CDF from './CDF';
export type { CDF };
import * as CREATE from './CREATE';
export type { CREATE };
import * as INFO from './INFO';
export type { INFO };
import * as MAX from './MAX';
export type { MAX };
import * as MERGE from './MERGE';
export type { MERGE };
import * as MIN from './MIN';
export type { MIN };
import * as QUANTILE from './QUANTILE';
export type { QUANTILE };
import * as RANK from './RANK';
export type { RANK };
import * as RESET from './RESET';
export type { RESET };
import * as REVRANK from './REVRANK';
export type { REVRANK };
import * as TRIMMED_MEAN from './TRIMMED_MEAN';
export type { TRIMMED_MEAN };

export default {
    ADD,
    add: ADD,
    BYRANK,
    byRank: BYRANK,
    BYREVRANK,
    byRevRank: BYREVRANK,
    CDF,
    cdf: CDF,
    CREATE,
    create: CREATE,
    INFO,
    info: INFO,
    MAX,
    max: MAX,
    MERGE,
    merge: MERGE,
    MIN,
    min: MIN,
    QUANTILE,
    quantile: QUANTILE,
    RANK,
    rank: RANK,
    RESET,
    reset: RESET,
    REVRANK,
    revRank: REVRANK,
    TRIMMED_MEAN,
    trimmedMean: TRIMMED_MEAN
};

export interface CompressionOption {
    COMPRESSION?: number;
}

export function pushCompressionArgument(
    args: RedisCommandArguments,
    options?: CompressionOption
): RedisCommandArguments {
    if (options?.COMPRESSION) {
        args.push('COMPRESSION', options.COMPRESSION.toString());
    }

    return args;
}

export function transformDoubleReply(reply: string): number {
    switch (reply) {
        case 'inf':
            return Infinity;

        case '-inf':
            return -Infinity;

        case 'nan':
            return NaN;

        default:
            return parseFloat(reply);
    }
}

export function transformDoublesReply(reply: Array<string>): Array<number> {
    return reply.map(transformDoubleReply);
}
