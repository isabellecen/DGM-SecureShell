import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { completeLogoutCache } from "./auth-cache";

test("completeLogoutCache marks the user logged out and clears protected query data", async () => {
  const client = new QueryClient();

  client.setQueryData(["/api/auth/me"], { user: { username: "admin" } });
  client.setQueryData(["/api/jobs"], [{ id: 1, name: "Nightly" }]);
  client.setQueryData(["/api/incidents"], [{ id: 1, state: "OPEN" }]);

  await completeLogoutCache(client);

  assert.equal(client.getQueryData(["/api/auth/me"]), null);
  assert.equal(client.getQueryData(["/api/jobs"]), undefined);
  assert.equal(client.getQueryData(["/api/incidents"]), undefined);
});
