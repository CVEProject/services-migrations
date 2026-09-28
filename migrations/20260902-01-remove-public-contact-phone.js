const PUBLIC_PHONE_PATH = 'contact_info.phone'
const REVIEW_PHONE_PATH = 'new_review_data.contact_info.phone'

module.exports = {
  async up (db) {
    await db.collection('BaseOrg').updateMany(
      { [PUBLIC_PHONE_PATH]: { $exists: true } },
      { $unset: { [PUBLIC_PHONE_PATH]: '' } }
    )

    await db.collection('ReviewObject').updateMany(
      { [REVIEW_PHONE_PATH]: { $exists: true } },
      { $unset: { [REVIEW_PHONE_PATH]: '' } }
    )
  },

  async down () {
    // Public phone values are intentionally removed and cannot be restored.
  }
}
