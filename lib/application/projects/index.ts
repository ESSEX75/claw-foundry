/** Exposes project context resolution shared by application commands and adapters. */

export { linkProjectChannel, unlinkProjectChannel } from "./channels.js";
export { findProjectByRoute, resolveProject, resolveProjectByRoute, resolveProvider } from "./context.js";
export { registerProject } from "./registration.js";
export { selectProject } from "./selection.js";
export type { LinkProjectChannelInput, ProjectChannelInput, ProjectChannelResult, ProjectContext, ProjectRoute, RegisterProjectInput, RegisterProjectResult } from "./types.js";
