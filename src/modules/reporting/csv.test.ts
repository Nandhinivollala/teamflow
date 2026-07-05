import assert from "node:assert/strict";
import test from "node:test";
import { exportFilteredTasksCsv } from "./csv.ts";

const tasks = [
  { key: "TF-1", title: "Ship API", status: "OPEN", assigneeId: "a", projectIds: ["p1"] },
  { key: "TF-2", title: 'Fix "quoted", title', status: "DONE", assigneeId: "b", projectIds: ["p1", "p2"] },
];

test("CSV contains only records matching the active filter", () => {
  const csv = exportFilteredTasksCsv(tasks, { projectId: "p2", status: "DONE" });
  assert.match(csv, /TF-2/);
  assert.doesNotMatch(csv, /TF-1/);
});

test("CSV fields are escaped safely", () => {
  const csv = exportFilteredTasksCsv(tasks, { search: "quoted" });
  assert.match(csv, /"Fix ""quoted"", title"/);
});
