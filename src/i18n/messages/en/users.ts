export default {
  title: 'Board users',
  sort: {
    label: 'Sort users by',
    name: 'Name',
    role: 'Role',
    direction: 'Sort direction',
    asc: 'Ascending',
    desc: 'Descending',
  },
  pagination: {
    label: 'User list pagination',
    pageSize: 'Users per page',
    perPage: '{count} per page',
    status: 'Page {page} · {count} users',
  },
  loadFailed: 'Couldn’t load users.',
  changeRoleFailed: 'Couldn’t change the role.',
  confirmRole: {
    title: 'Change user permissions',
    description: 'Change {name}’s role from {from} to {to}?',
    confirm: 'Change role',
  },
  loading: 'Loading users…',
  noPermission: {
    title: 'No permission',
    description: 'Only board admins can manage user roles.',
  },
  empty: 'No users have signed in to the board yet.',
  noName: 'No name',
  noEmail: 'No email',
  emailLoadFailed: 'Couldn’t load the email.',
  moderationWarnings: '{count} content warnings',
}
