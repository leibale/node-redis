import type { RedisCommands } from '@redis/client/dist/lib/RESP/types';

import TFCALL from './TFCALL';
import TFCALLASYNC from './TFCALLASYNC';
import TFUNCTION_LOAD from './TFUNCTION_LOAD';
import TFUNCTION_DELETE from './TFUNCTION_DELETE';
export default {
  TFCALL,
  tFCall: TFCALL,
  TFCALLASYNC,
  tFCallAsync: TFCALLASYNC,
  TFUNCTION_DELETE,
  tFunctionDelete: TFUNCTION_DELETE,
  TFUNCTION_LOAD,
  tFunctionLoad: TFUNCTION_LOAD
} as const satisfies RedisCommands;
