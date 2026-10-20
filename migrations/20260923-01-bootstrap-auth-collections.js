const collections = {
  authUser: "AuthUser",
  authInvitation: "AuthInvitation",
  authCeremony: "AuthCeremony",
  authSession: "AuthSession",
  tokenV2: "TokenV2"
};

async function collectionExists(db, name) {
  const existingCollections = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return existingCollections.length > 0;
}

async function ensureCollectionExists(db, name) {
  if (!(await collectionExists(db, name))) {
    await db.createCollection(name);
  }
}

module.exports = {
  async up(db) {
    await Promise.all(Object.values(collections).map((name) => ensureCollectionExists(db, name)));

    await Promise.all([
      db.collection(collections.authUser).createIndex(
        { user: 1 },
        { name: "auth_user_user_unique", unique: true }
      ),
      db.collection(collections.authUser).createIndex(
        { "credentials.credentialId": 1 },
        { name: "auth_user_credential_id_unique", sparse: true, unique: true }
      ),
      db.collection(collections.authInvitation).createIndex(
        { id: 1 },
        { name: "auth_invitation_id_unique", unique: true }
      ),
      db.collection(collections.authInvitation).createIndex(
        { tokenHash: 1 },
        { name: "auth_invitation_token_hash_unique", unique: true }
      ),
      db.collection(collections.authInvitation).createIndex(
        { user: 1, revokedAt: 1, usedAt: 1, expiresAt: 1 },
        { name: "auth_invitation_user_lifecycle" }
      ),
      db.collection(collections.authCeremony).createIndex(
        { id: 1 },
        { name: "auth_ceremony_id_unique", unique: true }
      ),
      db.collection(collections.authCeremony).createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "auth_ceremony_expiry_ttl" }
      ),
      db.collection(collections.authSession).createIndex(
        { id: 1 },
        { name: "auth_session_id_unique", unique: true }
      ),
      db.collection(collections.authSession).createIndex(
        { tokenHash: 1 },
        { name: "auth_session_token_hash_unique", unique: true }
      ),
      db.collection(collections.authSession).createIndex(
        { absoluteExpiresAt: 1 },
        { expireAfterSeconds: 0, name: "auth_session_expiry_ttl" }
      ),
      db.collection(collections.authSession).createIndex(
        { user: 1, revokedAt: 1, idleExpiresAt: 1, absoluteExpiresAt: 1 },
        { name: "auth_session_user_lifecycle" }
      ),
      db.collection(collections.tokenV2).createIndex(
        { tokenHash: 1 },
        { name: "token_v2_token_hash_unique", unique: true }
      ),
      db.collection(collections.tokenV2).createIndex(
        { jti: 1 },
        { name: "token_v2_jti_unique", unique: true }
      ),
      db.collection(collections.tokenV2).createIndex(
        { activeSlot: 1 },
        { name: "token_v2_active_slot_unique", sparse: true, unique: true }
      ),
      db.collection(collections.tokenV2).createIndex(
        { "user.user_uuid": 1, purpose: 1, name: 1 },
        {
          name: "token_v2_service_token_user_name_unique",
          partialFilterExpression: { purpose: "service_token" },
          unique: true
        }
      ),
      db.collection(collections.tokenV2).createIndex(
        { "user.user_uuid": 1, purpose: 1, status: 1 },
        { name: "token_v2_user_purpose_status" }
      ),
      db.collection(collections.tokenV2).createIndex(
        { "organization.org_uuid": 1, status: 1 },
        { name: "token_v2_organization_status" }
      ),
      db.collection(collections.tokenV2).createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "token_v2_expiry_ttl" }
      )
    ]);
  },

  async down() {
    // Intentionally non-destructive: dropping these collections could erase
    // credentials, invitations, ceremonies, sessions, and token/audit records.
  }
};
