// The "Before" params, kept pure so test/before.test.ts can import them straight
// into Node (develop.ts needs the app's api).

import type { DevelopParams } from "./safelight";

/** The original's tone, colour and effects with `cur`'s framing and processing
 *  version. The Original snapshot can predate the photo's version (Reset all
 *  edits and Update processing both raise it), and a Before rendered with
 *  different processing than the After isn't a fair comparison. */
export function buildBeforeParams(cur: DevelopParams, original: DevelopParams): DevelopParams {
  return {
    ...original,
    crop: cur.crop,
    transform: cur.transform,
    straighten: cur.straighten,
    uprightMode: cur.uprightMode,
    guidedLines: cur.guidedLines,
    lensCorrection: cur.lensCorrection,
    processVersion: cur.processVersion,
  };
}
