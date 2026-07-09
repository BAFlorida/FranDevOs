import { useAuth } from "@workspace/replit-auth-web";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

// Mirrors the server's READ_ONLY_ROLES (see api-server permissionCatalog.ts).
// Read-only roles may navigate and view everything but never write, so the UI
// hides or disables every create/edit/delete/status-change control for them.
// This is role-based (not permission-based) on purpose: the server hard-blocks
// all writes for these roles regardless of their permission mapping.
const READ_ONLY_ROLES = ["observer"];

/**
 * Whether the acting user holds a read-only role (e.g. an Observer / PE
 * partner). When impersonating, /me resolves to the acting user, so a super
 * admin acting as an observer is correctly treated as read-only too.
 */
export function useReadOnly(): boolean {
  const { user } = useAuth();
  const { data: me } = useGetMe({
    query: { enabled: !!user, queryKey: getGetMeQueryKey() },
  });
  return !!me && READ_ONLY_ROLES.includes(me.role);
}
