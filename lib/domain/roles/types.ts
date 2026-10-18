/** Defines shared role and level contracts consumed by configuration and selection. */

import type { ValueOf } from "../../types.js";
import { DEFAULT_LEVELS, DEFAULT_ROLES } from "./const.js";

/** Built-in role identifier; runtime role membership comes from resolved configuration. */
export type RoleId = ValueOf<typeof DEFAULT_ROLES>;

/** Built-in capability level; runtime level membership comes from its resolved role. */
export type LevelId = ValueOf<typeof DEFAULT_LEVELS>;

/** Complete role-level definition before runtime concurrency defaults are resolved. */
export type RoleLevelDefinition = {
  /** Relative capability rank; larger values represent more capable workers. */
  readonly rank: number;
  /** Model identifier assigned to the level. */
  readonly model: string;
  /** Optional concurrency override; the workflow-wide limit applies when omitted. */
  readonly maxWorkers?: number;
  /** Optional emoji used when announcing work at this level. */
  readonly emoji?: string;
};

/** Definition of a role including its active levels. */
export type RoleDefinition<TLevelId extends string = LevelId> = {
  /** Active level definitions keyed by identifier. */
  levels: Readonly<Record<TLevelId, RoleLevelDefinition>>;
  /** Whether the role is enabled in the workflow pipeline. */
  enabled?: boolean;
};
