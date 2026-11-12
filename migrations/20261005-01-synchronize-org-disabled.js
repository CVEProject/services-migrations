module.exports = {
  async up (db) {
    const registryOrgs = db.collection('BaseOrg')
    const legacyOrgs = db.collection('Org')

    await registryOrgs.updateMany(
      { authority: 'SECRETARIAT' },
      { $set: { disabled: false } }
    )

    const orgs = registryOrgs.find({ disabled: { $type: 'bool' } }, {
      projection: { UUID: 1, authority: 1, disabled: 1 },
      readPreference: 'primary'
    })
    for await (const org of orgs) {
      if (!org.UUID || !Array.isArray(org.authority)) continue
      await legacyOrgs.updateOne(
        { UUID: org.UUID },
        { $set: { 'authority.active_roles': org.disabled ? [] : org.authority } }
      )
    }
  },

  async down () {
    // Previous roles and Secretariat disabled values cannot be safely recovered.
  }
}
