const COLLECTION_PAIRS = [
  { source: 'Org', target: 'BaseOrg' },
  { source: 'User', target: 'BaseUser' }
]
const BATCH_SIZE = 500

async function copyCreatedDates (db, { source, target }) {
  const targetCollection = db.collection(target)
  const cursor = db.collection(source).find(
    { UUID: { $type: 'string', $ne: '' }, 'time.created': { $exists: true } },
    { projection: { _id: 0, UUID: 1, 'time.created': 1 } }
  )
  let updates = []

  for await (const record of cursor) {
    const originalCreated = record.time?.created
    if (!(originalCreated instanceof Date) && typeof originalCreated !== 'string') continue
    if (typeof originalCreated === 'string' && originalCreated.trim() === '') continue

    const created = new Date(originalCreated)
    if (Number.isNaN(created.getTime())) continue

    updates.push({
      updateOne: {
        filter: { UUID: record.UUID, created: { $ne: created } },
        update: { $set: { created } },
        upsert: false
      }
    })

    if (updates.length === BATCH_SIZE) {
      await targetCollection.bulkWrite(updates)
      updates = []
    }
  }

  if (updates.length > 0) await targetCollection.bulkWrite(updates)
}

module.exports = {
  async up (db) {
    for (const pair of COLLECTION_PAIRS) {
      await copyCreatedDates(db, pair)
    }
  },

  async down () {
    // The overwritten creation dates cannot be reconstructed; retain the legacy dates.
  }
}
