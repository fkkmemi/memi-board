export default {
  loading: 'Loading settings…',
  noAccess: 'You don’t have access',
  notFound: {
    title: 'Board not found',
    checkAddress: 'Please check the address.',
    checkBoardAddress: 'Please check the board address.',
  },
  newBoard: {
    title: 'This board doesn’t exist yet',
    description: 'Fill in the details below and save to create it with this ID.',
  },
  noLabel: 'No label',
  option: {
    default: 'Standard',
  },
  id: {
    label: 'Category ID',
    help: 'Used in the URL and data',
  },
  writeRole: {
    label: 'Who can post',
    help: 'Minimum role required to post in this category',
    helpShort: 'Minimum role required to post',
    options: {
      user: 'Users and up',
      staff: 'Staff and up',
      admin: 'Admins only',
    },
  },
  commentWriteRole: {
    label: 'Who can comment',
    help: 'Minimum role required to comment in this category',
    helpShort: 'Minimum role required to comment',
    hiddenHelp: 'Comments on hidden boards don’t appear in the public feed, and only assigned staff can write them',
    hiddenFixed: 'Assigned staff only (fixed for hidden boards)',
  },
  staff: {
    label: 'Assigned staff',
    help: 'Only the selected staff can configure and manage this board. Leave empty for admins only',
    placeholder: 'Admins only (no staff assigned)',
  },
  label: {
    label: 'Display name',
    help: 'The name users see',
  },
  description: {
    label: 'Description',
    help: 'Shown at the top of the board and elsewhere',
    placeholder: 'A short description of this board (optional)',
  },
  visibility: {
    label: 'Visibility',
    help: 'Hidden boards don’t appear in the all-boards filter, and posts can only be read by admins, assigned staff, and their authors. Only assigned staff can comment',
    options: {
      public: { label: 'Visible', description: 'Shown in the full list and filters' },
      hidden: { label: 'Hidden', description: 'Journal or private. Only assigned staff can comment' },
    },
  },
  listView: {
    label: 'List view',
    help: 'How the post list is displayed',
    options: {
      dense: 'Compact',
      video: 'Video',
    },
  },
  editorType: {
    label: 'Post form',
    help: 'How posts are written',
    options: {
      default: 'Write a title and body',
      image: 'Add multiple photos and a cover photo',
    },
  },
  locale: {
    label: 'Board language',
    help: 'Leave empty to follow the site language. If set, this board always appears in that language.',
    auto: 'Auto (follow site language)',
  },
  action: {
    moveDown: 'Down',
    goToBoard: 'Go to board',
    deleteBoard: 'Delete board',
    create: 'Create',
  },
  newCategoryPlaceholder: 'New category name',
  deleteConfirm: 'Delete the “{label}” board?\n\nAll posts, comments, replies, inline images, and attachments on this board will be permanently deleted. This can’t be undone.',
  savedCategory: 'Saved the “{label}” category.',
  savedSettings: 'Board settings saved.',
  created: 'Board created.',
  error: {
    orderFailed: 'Couldn’t save the category order.',
    deleteFailed: 'Couldn’t delete the board and its data.',
    saveFailed: 'Couldn’t save the board settings.',
    deleteAllFailed: 'Couldn’t delete the board data.',
  },
  danger: {
    title: 'Danger zone',
    description: 'Permanently deletes all posts, comments, attachments, and category settings. Board users and admin roles are kept.',
    confirmLabel: 'Type “{phrase}” to confirm',
    phrase: 'delete board data',
    button: 'Delete all data',
    done: 'All board data has been deleted.',
  },
}
