/** Owns isolated workspace resource names and fixture defaults. */

/** Registry fixture written directly only within an isolated test workspace. */
export const PROJECTS_FIXTURE_FILE_NAME = "projects.json";

/** Temporary workspace namespace. */
export const WORKSPACE_TEMP_PREFIX = "claw-foundry-e2e-";

/** Test log resource created before diagnostic effects run. */
export const LOG_DIRECTORY_NAME = "log";

/** Directory holding role instruction fixtures. */
export const PROMPTS_DIRECTORY_NAME = "prompts";

/** Extension recognized by role instruction loading. */
export const PROMPT_EXTENSION = ".md";

/** SDK orchestrator bootstrap resource exercised by the harness. */
export const BOOTSTRAP_FILE_NAME = "AGENTS.md";

/** Native removal retries for detached diagnostic cleanup races. */
export const CLEANUP_MAX_RETRIES = 10;

/** Delay between native temporary workspace removal retries. */
export const CLEANUP_RETRY_DELAY_MS = 25;

/** Default project identity shared by harness state and provider runtime fixtures. */
export const DEFAULT_PROJECT_NAME = "test-project";

/** Default Telegram conversation identity for isolated fixture routing. */
export const DEFAULT_CHANNEL_ID = "-1234567890";

/** Placeholder repository path; the harness never executes commands there. */
export const DEFAULT_REPOSITORY_PATH = "/tmp/test-repo";

/** Default repository branch for fixture projects. */
export const DEFAULT_BASE_BRANCH = "main";

/** Project agent identity used by bootstrap and routing fixtures. */
export const DEFAULT_AGENT_ID = "test-agent";

/** Primary notification endpoint name used in managed fixture initialization. */
export const PRIMARY_CHANNEL_NAME = "primary";

/** SDK channel account selected by fixture projects. */
export const DEFAULT_ACCOUNT_ID = "default";

/** Default explicit level for supplied worker slot overrides. */
export const DEFAULT_WORKER_LEVEL = "senior";
