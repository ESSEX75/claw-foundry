/** Validates temporal values before repositories accept scheduling or recovery evidence. */

import { z } from "zod";

/** Explicit ISO timestamp with timezone, preserving its original identity representation. */
export const TimestampSchema = z.iso.datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)));
