const ACTIVE_ROLE_PATH = 'authority.active_roles.0'

module.exports = {
  async up (db) {
    const baseOrgCollection = db.collection('BaseOrg')
    const orgCollection = db.collection('Org')

    await baseOrgCollection.updateMany(
      {},
      { $set: { disabled: true } }
    )

    const enabledOrgUUIDs = (await orgCollection.distinct(
      'UUID',
      { [ACTIVE_ROLE_PATH]: { $exists: true } }
    )).filter(UUID => typeof UUID === 'string' && UUID.length > 0)

    if (enabledOrgUUIDs.length > 0) {
      await baseOrgCollection.updateMany(
        { UUID: { $in: enabledOrgUUIDs } },
        { $set: { disabled: false } }
      )
    }
  },

  async down () {
    // Existing migration values cannot be distinguished from later Secretariat updates.
  }
}
