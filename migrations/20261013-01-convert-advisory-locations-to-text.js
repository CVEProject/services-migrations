async function convertArraysToText (collection, field) {
  const records = collection.find({ [field]: { $type: 'array' } }, {
    projection: { [field]: 1 },
    readPreference: 'primary'
  })

  for await (const record of records) {
    const locations = field === 'advisory_locations'
      ? record.advisory_locations
      : record.new_review_data.advisory_locations
    await collection.updateOne(
      { _id: record._id, [field]: locations },
      { $set: { [field]: locations.join('\n') } }
    )
  }
}

module.exports = {
  async up (db) {
    await convertArraysToText(db.collection('BaseOrg'), 'advisory_locations')
    await convertArraysToText(db.collection('ReviewObject'), 'new_review_data.advisory_locations')
  },

  async down () {
    // Array boundaries cannot be recovered safely when entries contain newlines.
  }
}
