/** Strict topic selection owned by the workflow guidance adapter. */

import { z } from "zod";

import { WORKFLOW_GUIDE_TOPICS } from "./const.js";

/** Validates topic selection before resolving the SDK workspace. */
export const workflowGuideInput = z.strictObject({
  topic: z.enum(WORKFLOW_GUIDE_TOPICS).describe("Optional guide section. Omit for the full guide.").optional(),
});
