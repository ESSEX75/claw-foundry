/** Exercises the supported application entrypoint and prevents internal composition/renderer leakage. */

import assert from "node:assert/strict";
import { it } from "node:test";
import * as application from "./index.js";
import * as execution from "./execution/index.js";
import * as issues from "./issues/index.js";
import * as projects from "./projects/index.js";
import * as workspace from "./workspace/index.js";

it("loads supported use cases without exposing private renderers or heartbeat composition", () => {
  for (const operation of [application.startTask, application.dispatchTask, application.executeCompletion,
    application.runSetup, application.registerHeartbeatService, application.listManagedTasks,
    application.runWorkspaceDiagnostics, application.inspectProjectRoute, application.inspectWorkerHealth,
    application.provisionLabelCatalog, application.formatAttachmentsForTask]) {
    assert.equal(typeof operation, "function");
  }
  for (const name of ["formatAttachmentComment", "formatSessionLabel", "buildAnnouncement", "renderCompletionAnnouncement",
    "createHeartbeatLifecycle", "HEARTBEAT_SERVICE", "recordProviderMissing", "setIntegrityStatus", "runRoutingDoctor", "getAutomaticTransitionCandidates", "notifyReviewEvent", "reviewPass",
    "resolveSetupModels", "writePluginConfig", "planSetup", "getAgentId", "ensureChannelBinding", "buildAgentToolPolicy", "allocateEndpointName", "matchesProjectRoute"]) {
    assert.equal(name in application, false, `${name} is private implementation`);
  }
});

it("exposes grouped use cases through the unchanged external application API", () => {
  assert.equal(workspace.runSetup, application.runSetup);
  assert.equal(workspace.resetWorkspaceConfig, application.resetWorkspaceConfig);
  assert.equal(projects.registerProject, application.registerProject);
  assert.equal(projects.inspectProjectRoute, application.inspectProjectRoute);
  assert.equal(projects.syncProjectLabels, application.syncProjectLabels);
  assert.equal(issues.createManagedTaskIssue, application.createManagedTaskIssue);
  assert.equal(issues.listManagedTasks, application.listManagedTasks);
  assert.equal(issues.repairManagedIssue, application.repairManagedIssue);
  assert.equal(execution.dispatchTask, application.dispatchTask);
  assert.equal(execution.finishWork, application.finishWork);
  assert.equal(execution.registerHeartbeatService, application.registerHeartbeatService);
});
