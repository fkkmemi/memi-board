export default {
  unsupportedRole: 'Unsupported role.',
  guide: {
    title: 'User role guide',
    assignmentNote: 'Assign managers and staff to specific boards in each board’s settings. Changing a role does not automatically assign any boards.',
    owner: {
      permissions: 'Manages user roles, board settings, and all content.',
      roles: 'Appoints or removes admins and changes manager, staff, and user roles.',
      restriction: 'Ownership cannot be assigned or transferred here. Configure it through the server or console.',
    },
    admin: {
      permissions: 'Manages board settings and posts and comments across all boards.',
      roles: 'Changes manager, staff, and user roles.',
      restriction: 'Cannot change other admins’ or the owner’s role.',
    },
    manager: {
      permissions: 'Changes settings and assigns staff for assigned boards.',
      roles: 'Manages posts and comments in assigned boards.',
      restriction: 'Cannot change service-wide settings or user roles.',
    },
    staff: {
      permissions: 'Manages posts and comments in assigned boards.',
      roles: 'Cannot change board settings or board assignments.',
      restriction: 'Cannot change service-wide settings or user roles.',
    },
    user: {
      permissions: 'Writes posts and comments as allowed by each board.',
      roles: 'Edits or deletes their own posts and comments.',
      restriction: 'Cannot access user management or board settings.',
    },
  },
  roleDescription: {
    owner: 'Manages administrators and the entire service.',
    manager: 'Manages settings and staff assignments for assigned boards.',
    admin: 'Manages user roles, board settings, and all content.',
    staff: 'Manages posts and comments in assigned boards, but cannot change settings or assignments.',
    user: 'Can write posts and comments, and edit or delete only their own content.',
  },
}
