/**
 * Verifies workflow queries through the workflow subpackage's supported API.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_ROLES, type RoleDefinition, type RoleId } from "../roles/index.js";
import {
  DEFAULT_WORKFLOW,
  detectRoleFromLabel,
  findStateKeyByLabel,
  getActiveLabel,
  getCompletionRule,
  getProjectedStateLabel,
  getRevertLabel,
  hasTestPhase,
  STATE_TYPE,
  WORKFLOW_EVENT,
  WORKFLOW_STATE_KEYS,
  WORKFLOW_STATE_LABELS,
  type BuiltInWorkflowConfig,
  type WorkflowDefinition,
  type WorkflowConfig,
  type WorkflowLabel,
  type WorkflowStateKey,
} from "./index.js";
import { WORKFLOW_STATE_COLORS } from "./const.js";

describe("built-in test phase", () => {
  it("recognizes tester queues and active states without inferring custom QA roles", () => {
    for (const type of [STATE_TYPE.QUEUE, STATE_TYPE.ACTIVE]) {
      const workflow: WorkflowConfig = { initial: "qa", states: {
        qa: { type, role: "tester", label: "QA", color: "#111111" },
      } };

      assert.equal(hasTestPhase(workflow), true);
      workflow.states.qa = { type, role: "security", label: "QA", color: "#111111" };
      assert.equal(hasTestPhase(workflow), false);
    }
    assert.equal(hasTestPhase({ initial: "hold", states: {
      hold: { type: STATE_TYPE.HOLD, label: "Hold", color: "#111111" },
    } }), false);
  });
});

describe("projected workflow labels", () => {
  it("reports the first configured match without treating conflicting observations as local truth", () => {
    assert.equal(getProjectedStateLabel(["Doing", "To Do"], DEFAULT_WORKFLOW), "To Do");
    assert.equal(getProjectedStateLabel(["unmanaged"], DEFAULT_WORKFLOW), null);
  });
});

describe("getRevertLabel", () => {
  it("matches an object-form PICKUP transition target", () => {
    const workflow: BuiltInWorkflowConfig = {
      ...DEFAULT_WORKFLOW,
      states: {
        ...DEFAULT_WORKFLOW.states,
        [WORKFLOW_STATE_KEYS.TODO]: {
          type: STATE_TYPE.QUEUE,
          role: DEFAULT_ROLES.DEVELOPER,
          label: WORKFLOW_STATE_LABELS.TODO,
          color: WORKFLOW_STATE_COLORS.TODO,
          priority: 10,
          on: {
            [WORKFLOW_EVENT.PICKUP]: {
              target: WORKFLOW_STATE_KEYS.RESEARCHING,
            },
          },
        },
        [WORKFLOW_STATE_KEYS.TO_IMPROVE]: {
          type: STATE_TYPE.QUEUE,
          role: DEFAULT_ROLES.DEVELOPER,
          label: WORKFLOW_STATE_LABELS.TO_IMPROVE,
          color: WORKFLOW_STATE_COLORS.TO_IMPROVE,
          priority: 1,
          on: {
            [WORKFLOW_EVENT.PICKUP]: {
              target: WORKFLOW_STATE_KEYS.DOING,
            },
          },
        },
      },
    };

    assert.equal(
      getRevertLabel(workflow, DEFAULT_ROLES.DEVELOPER),
      WORKFLOW_STATE_LABELS.TO_IMPROVE,
    );
  });
});

describe("extensible workflow queries", () => {
  it("accepts validated runtime identifiers without generic arguments", () => {
    const workflow: WorkflowConfig = {
      initial: "customQueue",
      states: {
        customQueue: {
          type: STATE_TYPE.QUEUE,
          role: "security_auditor",
          label: "Security Queue",
          color: "#123456",
          on: {
            [WORKFLOW_EVENT.PICKUP]: {
              target: "customActive",
            },
          },
        },
        customActive: {
          type: STATE_TYPE.ACTIVE,
          role: "security_auditor",
          label: "Security Active",
          color: "#654321",
        },
      },
    };

    assert.equal(findStateKeyByLabel(workflow, "Security Active"), "customActive");
    assert.equal(detectRoleFromLabel(workflow, "Security Queue"), "security_auditor");
  });

  it("preserves custom role, state key, label, and level types", () => {
    type CustomRoleId = RoleId | "security_auditor";
    type CustomStateKey = WorkflowStateKey | "securityReview" | "securityReviewing";
    type CustomLabel = WorkflowLabel | "Security Review" | "Security Reviewing";
    type CustomLevelId = "standard" | "expert";

    const customRole: RoleDefinition<CustomLevelId> = {
      levels: {
        standard: { rank: 1, model: "model/standard" },
        expert: { rank: 2, model: "model/expert" },
      },
      enabled: true,
    };
    const workflow: WorkflowDefinition<CustomRoleId, CustomStateKey, CustomLabel> = {
      ...DEFAULT_WORKFLOW,
      states: {
        ...DEFAULT_WORKFLOW.states,
        securityReview: {
          type: STATE_TYPE.QUEUE,
          role: "security_auditor",
          label: "Security Review",
          color: "#123456",
          on: {
            [WORKFLOW_EVENT.PICKUP]: {
              target: "securityReviewing",
            },
          },
        },
        securityReviewing: {
          type: STATE_TYPE.ACTIVE,
          role: "security_auditor",
          label: "Security Reviewing",
          color: "#654321",
          on: {
            [WORKFLOW_EVENT.COMPLETE]: {
              target: WORKFLOW_STATE_KEYS.DONE,
            },
          },
        },
      },
    };
    const stateKey: CustomStateKey | null = findStateKeyByLabel(workflow, "Security Review");
    const role: CustomRoleId | null = detectRoleFromLabel(workflow, "Security Review");
    const activeLabel: CustomLabel = getActiveLabel(workflow, "security_auditor");
    const completionRule = getCompletionRule(
      workflow,
      "security_auditor",
      WORKFLOW_EVENT.COMPLETE,
    );

    assert.deepEqual(Object.keys(customRole.levels), ["standard", "expert"]);
    assert.equal(stateKey, "securityReview");
    assert.equal(role, "security_auditor");
    assert.equal(activeLabel, "Security Reviewing");
    assert.equal(completionRule?.from, "Security Reviewing");
    assert.equal(completionRule?.to, WORKFLOW_STATE_LABELS.DONE);
  });
});
