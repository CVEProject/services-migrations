const BATCH_SIZE = 500

module.exports = {
    async up(db) {
        const baseUsers = db.collection('BaseUser')
        const users = db.collection('User').find(
            { UUID: { $type: 'string', $ne: '' }, active: { $in: [true, false, 'true', 'false'] } },
            { projection: { _id: 0, UUID: 1, active: 1 }, readPreference: 'primary' }
        )
        let updates = []

        for await (const user of users) {
            // MongoDB predicates also match array elements; only accept scalar values.
            if (typeof user.UUID !== 'string' || user.UUID.length === 0) continue
            if (![true, false, 'true', 'false'].includes(user.active)) continue
            const status = user.active === true || user.active === 'true' ? 'active' : 'inactive'

            updates.push({
                updateOne: {
                    filter: { UUID: user.UUID, status: { $ne: status } },
                    update: { $set: { status } },
                    upsert: false
                }
            })

            if (updates.length === BATCH_SIZE) {
                await baseUsers.bulkWrite(updates)
                updates = []
            }
        }

        if (updates.length > 0) await baseUsers.bulkWrite(updates)
    },

    async down() {
        // Previous statuses cannot be reconstructed safely; retain the copied values.
    }
}