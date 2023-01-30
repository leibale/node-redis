
import * as ADD from './ADD';
export type { ADD };
import * as ADDNX from './ADDNX';
export type { ADDNX };
import * as COUNT from './COUNT';
export type { COUNT };
import * as DEL from './DEL';
export type { DEL };
import * as EXISTS from './EXISTS';
export type { EXISTS };
import * as INFO from './INFO';
export type { INFO };
import * as INSERT from './INSERT';
export type { INSERT };
import * as INSERTNX from './INSERTNX';
export type { INSERTNX };
import * as LOADCHUNK from './LOADCHUNK';
export type { LOADCHUNK };
import * as RESERVE from './RESERVE';
export type { RESERVE };
import * as SCANDUMP from './SCANDUMP';
export type { SCANDUMP };
import { pushVerdictArguments } from '@redis/client/dist/lib/commands/generic-transformers';
import { RedisCommandArguments } from '@redis/client/dist/lib/commands';

export default {
    ADD,
    add: ADD,
    ADDNX,
    addNX: ADDNX,
    COUNT,
    count: COUNT,
    DEL,
    del: DEL,
    EXISTS,
    exists: EXISTS,
    INFO,
    info: INFO,
    INSERT,
    insert: INSERT,
    INSERTNX,
    insertNX: INSERTNX,
    LOADCHUNK,
    loadChunk: LOADCHUNK,
    RESERVE,
    reserve: RESERVE,
    SCANDUMP,
    scanDump: SCANDUMP
};

export interface InsertOptions {
    CAPACITY?: number;
    NOCREATE?: true;
}

export function pushInsertOptions(
    args: RedisCommandArguments,
    items: string | Array<string>,
    options?: InsertOptions
): RedisCommandArguments {
    if (options?.CAPACITY) {
        args.push('CAPACITY');
        args.push(options.CAPACITY.toString());
    }

    if (options?.NOCREATE) {
        args.push('NOCREATE');
    }

    args.push('ITEMS');
    return pushVerdictArguments(args, items);
}
