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
   * Update consent status and tokens
   */
  async updateAuthorizedConsent(id, data) {
    const [consent] = await db('consents')
      .where({ id })
      .update({ 
        status: data.status,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        bank_user_id: data.bank_user_id,
        updated_at: db.fn.now()
      })
      .returning('*')
    
    return consent
  }
}

export default new ConsentService()
