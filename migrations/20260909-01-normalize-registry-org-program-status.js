const TITLE_CASE_STATUS_BY_LOWER_CASE = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending'
}

module.exports = {
  async up (db) {
    const baseOrgCollection = db.collection('BaseOrg')

    await Promise.all(
      Object.entries(TITLE_CASE_STATUS_BY_LOWER_CASE).map(([lowerCaseStatus, titleCaseStatus]) =>
        baseOrgCollection.updateMany(
          { 'program_data.status': lowerCaseStatus },
          { $set: { 'program_data.status': titleCaseStatus } }
        )
      )
    )
  },

  async down (db) {
    const baseOrgCollection = db.collection('BaseOrg')

    await Promise.all(
      Object.entries(TITLE_CASE_STATUS_BY_LOWER_CASE).map(([lowerCaseStatus, titleCaseStatus]) =>
        baseOrgCollection.updateMany(
          { 'program_data.status': titleCaseStatus },
          { $set: { 'program_data.status': lowerCaseStatus } }
        )
      )
    )
  }
}
