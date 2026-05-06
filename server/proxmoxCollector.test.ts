import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://user:password@localhost:5432/protectiveshell_test";

const { proxmoxCollectorInternals } = await import("./proxmoxCollector");

test("parseZpoolList reads health from explicit zpool columns", () => {
  const result = proxmoxCollectorInternals.parseZpoolList("rpool\t1.81T\t812G\t1.02T\t12%\t43%\tONLINE");

  assert.equal(result.status, "OK");
  assert.deepEqual(result.pools, [
    {
      name: "rpool",
      state: "ONLINE",
      size: "1.81T",
      alloc: "812G",
      free: "1.02T",
      frag: "12%",
      cap: "43%",
    },
  ]);
});
