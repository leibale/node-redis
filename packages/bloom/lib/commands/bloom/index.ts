import { RedisCommandSignature } from '@redis/client/dist/lib/commands';
import * as ADD from './ADD';
export type { ADD };

export type TEST = RedisCommandSignature<typeof ADD>;

import * as CARD from './CARD';
export type { CARD };
import * as EXISTS from './EXISTS';
export type { EXISTS };
import * as INFO from './INFO';
export type { INFO };
import * as INSERT from './INSERT';
export type { INSERT };
import * as LOADCHUNK from './LOADCHUNK';
export type { LOADCHUNK };
import * as MADD from './MADD';
export type { MADD };
import * as MEXISTS from './MEXISTS';
export type { MEXISTS };
import * as RESERVE from './RESERVE';
export type { RESERVE };
import * as SCANDUMP from './SCANDUMP';
export type { SCANDUMP };

export default {
    ADD,
    add: ADD,
    CARD,
    card: CARD,
    EXISTS,
    exists: EXISTS,
    INFO,
    info: INFO,
    INSERT,
    insert: INSERT,
    LOADCHUNK,
    loadChunk: LOADCHUNK,
    MADD,
    mAdd: MADD,
    MEXISTS,
    mExists: MEXISTS,
    RESERVE,
    reserve: RESERVE,
    SCANDUMP,
    scanDump: SCANDUMP
} as const;

