import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTaskWarnings } from "./warnings.ts";

test("dependency and overload conflicts produce warnings instead of rejection", () => {
  assert.deepEqual(
    evaluateTaskWarnings({
      unresolvedBlockerIds: ["TF-1", "TF-1", "TF-2"],
      assigneeOpenTaskCount: 8,
      assigneeCapacity: 8,
    }),
    [
      { code: "UNRESOLVED_DEPENDENCIES", blockerIds: ["TF-1", "TF-2"] },
      { code: "ASSIGNEE_OVERLOAD", openTaskCount: 8, capacity: 8 },
    ],
  );
});

test("a task without conflicts has no warnings", () => {
  assert.deepEqual(evaluateTaskWarnings({ unresolvedBlockerIds: [] }), []);
});
