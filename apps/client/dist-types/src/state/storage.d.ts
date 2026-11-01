import type { Content } from '@gt/shared';
import { type GameState } from '@gt/sim';
export declare const SAVE_KEY = "gt.save";
export declare const BACKUP_KEY = "gt.save.bak";
export declare function loadGame(c: Content, now: number, storage?: Storage | null): GameState;
export declare function saveGame(s: GameState, storage?: Storage | null): void;
