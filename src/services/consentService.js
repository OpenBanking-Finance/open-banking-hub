import db from '../db/knex.js'

class ConsentService {
  /**
   * Create a new consent request in AWAITING_AUTHORISATION status
   */
  async createConsent(data) {
    const [consent] = await db('consents').insert({
      user_id: data.user_id,
      bank_id: data.bank_id,
      permissions: JSON.stringify(data.permissions || []),
      expiration_date: data.expiration_date,
      status: 'AWAITING_AUTHORISATION'
    }).returning('*')
    
    return consent
  }

  /**
   * Get consent by ID
   */
  async getConsentById(id) {
    return db('consents').where({ id }).first()
  }

  /**
   * Update consent status and tokens after bank authorisation
   */
  async updateAuthorizedConsent(id, data) {
    const update = {
      status: data.status,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      bank_user_id: data.bank_user_id,
      updated_at: db.fn.now()
    }

    if (data.selected_accounts !== undefined) {
      update.selected_accounts = JSON.stringify(data.selected_accounts)
    }

    if (data.granted_permissions !== undefined) {
      update.granted_permissions = JSON.stringify(data.granted_permissions)
    }

    const [consent] = await db('consents').where({ id }).update(update).returning('*')
    return consent
  }

  /**
   * Revoke an active consent
   */
  async revokeConsent(id) {
    const [consent] = await db('consents')
      .where({ id })
      .whereIn('status', ['AWAITING_AUTHORISATION', 'AUTHORISED'])
      .update({ status: 'REVOKED', updated_at: db.fn.now() })
      .returning('*')
    return consent || null
  }
}

export default new ConsentService()
