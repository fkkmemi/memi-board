# 0.46 role migration

[Host installation guide](host-integration.md) · [Internationalization and translation](internationalization.md) · [Firebase setup](firebase-setup.md)

For a new install, set the role of the user document created on sign-in to `owner` from a trusted console or server. The admin → owner and staff → manager migration below is needed only for host apps that used the previous 3 roles. It is not a task of repeatedly converting newly created admins to owner.

Roles: user (regular user), staff (content), manager (settings and staff assignment for assigned boards), admin (full management), owner (assigns administrators).

`allowedStaffUids` lists content staff, and `allowedManagerUids` lists settings managers. If a manager is assigned only to another board's allowedStaffUids, they manage only content on that board. The global role is an eligibility; the actual scope is determined by the board document. Linking the host's organizations, such as stores, to boards and syncing assignments is the host app's responsibility.

For compatibility, `isAdmin` includes owner and `isStaff` includes manager. Check the exact role with `role`, `isOwner`, and `isManager`. Use `canConfigureBoard(boardId)` for entering the settings screen and `canManageBoard(boardId)` for content management. The minimum roles for writing posts and comments remain user/staff/admin (manager counts as staff level, owner as admin level).

```ts
// nuxt.config.ts
memiBoard: {
  roleLabels: { user: 'Customer', staff: 'Store staff', manager: 'Store manager', admin: 'Operator', owner: 'Super admin' }
}
```

If omitted, the default labels for each language are used. Custom labels apply identically to all languages.

## Rollout order

1. Apply the new package and role-aware code to the host app.
2. Merge the Firestore and Storage rule examples into the host's existing rules and test them in the emulator.
3. Deploy the new rules. An App Hosting deployment alone does not update the rules.
4. With a trusted Admin SDK, move existing admins to owner and existing staff to manager. Move each board's existing staff UIDs to allowedManagerUids. Leave regular users as they are. If there are several existing admins, all of them become owners, so review the count beforehand.
5. Deploy the new host app and refresh sign-in state.

memi-dev's scripts/migrate-board-roles.mjs runs as a dry run by default and applies changes in a transaction with --apply. Previous roles and assignments are recorded in memiBoardMigrations/roles-v046, which is blocked from client access. If the completion marker exists, rerunning does not re-promote new roles. Assigning or transferring owner must be done only through trusted server operations.

## File permissions

Because of the Firestore read limit in Storage rules, the default rules let only the author and a global admin/owner modify or delete other users' files. Do not give staff/manager global file permissions. When staff/manager delete other users' posts, file cleanup uses the existing best-effort approach, so remaining files must be cleaned up by the host server. Host apps where assigned staff need to replace other users' images or attachments must implement a server API that verifies the token and the assignment to that board.

Managers cannot change visibility, create or delete boards, change their own manager assignment, or change global roles. Assigned staff can only be chosen from accounts that already have staff/manager eligibility.
