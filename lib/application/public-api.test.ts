/** Exercises the supported application entrypoint and prevents internal composition/renderer leakage. */

import assert from "node:assert/strict";
import { it } from "node:test";
import * as application from "./index.js";

it("loads supported use cases without exposing private renderers or heartbeat composition", () => {
  for (const operation of [application.startTask, application.dispatchTask, application.executeCompletion,
    application.runSetup, application.registerHeartbeatService, application.listManagedTasks,
    application.runWorkspaceDiagnostics, application.inspectProjectRoute, application.inspectWorkerHealth,
    application.provisionLabelCatalog, application.formatAttachmentsForTask]) {
    assert.equal(typeof operation, "function");
  }
  for (const name of ["formatAttachmentComment", "formatSessionLabel", "buildAnnouncement", "renderCompletionAnnouncement",
    "createHeartbeatLifecycle", "HEARTBEAT_SERVICE", "recordProviderMissing", "setIntegrityStatus", "runRoutingDoctor", "getAutomaticTransitionCandidates", "notifyReviewEvent", "reviewPass"]) {
    assert.equal(name in application, false, `${name} is private implementation`);
  }
});
