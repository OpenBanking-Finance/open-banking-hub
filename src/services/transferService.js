import db from '../db/knex.js'

class TransferService {
  async createTransfer(data) {
    const [transfer] = await db('transfers').insert({
      consent_id: data.consent_id,
      bank_id: data.bank_id,
      amount: data.amount,
      currency: data.currency || 'CVE',
      debtor_account: data.debtor_account,
      creditor_account: data.creditor_account,
      creditor_name: data.creditor_name,
      status: 'INITIATED'
    }).returning('*')
    return transfer
  }

  async getTransferById(id) {
    return db('transfers').where({ id }).first()
  }

  async updateTransfer(id, data) {
    const [transfer] = await db('transfers')
      .where({ id })
      .update({
        ...data,
        updated_at: db.fn.now()
      })
      .returning('*')
    return transfer
  }

  async getTransferByMojaloopId(mojaloopId) {
    return db('transfers').where({ mojaloop_transfer_id: mojaloopId }).first()
  }
}

export default new TransferService()
