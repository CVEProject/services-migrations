// Snapshot of DEFAULT_USER_QUOTA when this migration was introduced.
// Migrations run independently of the application repository.
const DEFAULT_USER_QUOTA = 100

module.exports = {
  async up (db) {
    await db.collection('BaseOrg').updateMany(
      { user_quota: null }, // Matches missing fields and explicit nulls.
      { $set: { user_quota: DEFAULT_USER_QUOTA } }
    )
  },

  async down () {
    // Removing quotas could erase later Secretariat decisions. Retain them.
  }
}
