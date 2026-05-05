import type { QueryClient } from "@tanstack/react-query";

const authMeQueryKey = ["/api/auth/me"] as const;

function isProtectedQuery(queryKey: readonly unknown[]) {
  return queryKey[0] !== authMeQueryKey[0];
}

export async function prepareLogoutCache(queryClient: QueryClient) {
  await queryClient.cancelQueries({
    predicate: (query) => isProtectedQuery(query.queryKey),
  });
}

export async function completeLogoutCache(queryClient: QueryClient) {
  await prepareLogoutCache(queryClient);
  queryClient.setQueryData(authMeQueryKey, null);
  queryClient.removeQueries({
    predicate: (query) => isProtectedQuery(query.queryKey),
  });
}
