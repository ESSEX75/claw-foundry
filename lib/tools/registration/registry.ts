/** Binds the fixed public tool names to SDK-compatible factories and plugin dependencies. */

import {
  CHANNEL_LINK_TOOL_NAME,
  CHANNEL_LIST_TOOL_NAME,
  CHANNEL_UNLINK_TOOL_NAME,
  createChannelLinkTool,
  createChannelListTool,
  createChannelUnlinkTool,
} from "../channels/index.js";
import { createWorkflowGuideTool, WORKFLOW_GUIDE_TOOL_NAME } from "../guidance/index.js";
import { createHealthTool, HEALTH_TOOL_NAME } from "../health/index.js";
import {
  createIssueDeleteTool,
  createIssuePolicyMigrationTool,
  createIssueRepairTool,
  ISSUE_DELETE_TOOL_NAME,
  ISSUE_POLICY_MIGRATE_TOOL_NAME,
  ISSUE_REPAIR_TOOL_NAME,
} from "../issues/index.js";
import { createSyncLabelsTool, SYNC_LABELS_TOOL_NAME } from "../labels/index.js";
import { createProjectRegisterTool, createProjectStatusTool, PROJECT_REGISTER_TOOL_NAME, PROJECT_STATUS_TOOL_NAME } from "../projects/index.js";
import { CONFIG_TOOL_NAME, createConfigTool, createOnboardTool, createSetupTool, ONBOARD_TOOL_NAME, SETUP_TOOL_NAME } from "../setup/index.js";
import {
  createResearchTaskTool,
  createTaskAttachTool,
  createTaskCommentTool,
  createTaskCreateTool,
  createTaskEditBodyTool,
  createTaskListTool,
  createTaskOwnerTool,
  createTaskSetLevelTool,
  createTasksStatusTool,
  createTaskStartTool,
  RESEARCH_TASK_TOOL_NAME,
  TASK_ATTACH_TOOL_NAME,
  TASK_COMMENT_TOOL_NAME,
  TASK_CREATE_TOOL_NAME,
  TASK_EDIT_BODY_TOOL_NAME,
  TASK_LIST_TOOL_NAME,
  TASK_OWNER_TOOL_NAME,
  TASK_SET_LEVEL_TOOL_NAME,
  TASK_START_TOOL_NAME,
  TASKS_STATUS_TOOL_NAME,
} from "../tasks/index.js";
import { createWorkFinishTool, WORK_FINISH_TOOL_NAME } from "../worker/index.js";
import type { ToolRegistryEntry } from "./types.js";

/** Supported tool registrations, checked against the SDK factory contract without widening results. */
export const toolRegistry = [
  { names: [TASK_START_TOOL_NAME], factory: createTaskStartTool },
  { names: [WORK_FINISH_TOOL_NAME], factory: createWorkFinishTool },

  { names: [TASK_CREATE_TOOL_NAME], factory: createTaskCreateTool },
  { names: [TASK_EDIT_BODY_TOOL_NAME], factory: createTaskEditBodyTool },
  { names: [TASK_COMMENT_TOOL_NAME], factory: createTaskCommentTool },
  { names: [TASK_ATTACH_TOOL_NAME], factory: createTaskAttachTool },
  { names: [TASK_SET_LEVEL_TOOL_NAME], factory: createTaskSetLevelTool },
  { names: [TASK_OWNER_TOOL_NAME], factory: createTaskOwnerTool },
  { names: [RESEARCH_TASK_TOOL_NAME], factory: createResearchTaskTool },
  { names: [ISSUE_REPAIR_TOOL_NAME], factory: createIssueRepairTool },
  { names: [ISSUE_POLICY_MIGRATE_TOOL_NAME], factory: createIssuePolicyMigrationTool },
  { names: [ISSUE_DELETE_TOOL_NAME], factory: createIssueDeleteTool },

  { names: [TASK_LIST_TOOL_NAME], factory: createTaskListTool },
  { names: [TASKS_STATUS_TOOL_NAME], factory: createTasksStatusTool },

  { names: [PROJECT_STATUS_TOOL_NAME], factory: createProjectStatusTool },
  { names: [PROJECT_REGISTER_TOOL_NAME], factory: createProjectRegisterTool },
  { names: [HEALTH_TOOL_NAME], factory: createHealthTool },
  { names: [SYNC_LABELS_TOOL_NAME], factory: createSyncLabelsTool },
  { names: [CHANNEL_LINK_TOOL_NAME], factory: createChannelLinkTool },
  { names: [CHANNEL_UNLINK_TOOL_NAME], factory: createChannelUnlinkTool },
  { names: [CHANNEL_LIST_TOOL_NAME], factory: createChannelListTool },

  { names: [SETUP_TOOL_NAME], factory: createSetupTool },
  { names: [ONBOARD_TOOL_NAME], factory: createOnboardTool },
  { names: [WORKFLOW_GUIDE_TOOL_NAME], factory: createWorkflowGuideTool },
  { names: [CONFIG_TOOL_NAME], factory: createConfigTool },
] as const satisfies readonly ToolRegistryEntry[];
