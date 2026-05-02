import axios from 'axios'
import db from '../db/knex.js'
import consentService from '../services/consentService.js'
import transferService from '../services/transferService.js'

export default async function transferRoutes(app) {
  
  const getBankApiUrl = async (bankId) => {
    const bank = await db('banks').where({ id: bankId }).first()
    return bank?.api_url
  }

  // Step 1 — Initiate Transfer
  app.post('/transfers', async (request, reply) => {
    const { consentId, amount, currency, debtorAccount, creditorAccount, creditorName, creditorIdType } = request.body

    if (!consentId) return reply.status(400).send({ error: 'consentId is required' })

    try {
      const consent = await consentService.getConsentById(consentId)
      if (!consent || consent.status !== 'AUTHORISED') {
        return reply.status(403).send({ error: 'Unauthorised', message: 'Consent not authorised' })
      }

      // Check against what the USER granted, falling back to what the fintech requested
      const effectivePermissions = (() => {
        try {
          const granted = typeof consent.granted_permissions === 'string'
            ? JSON.parse(consent.granted_permissions)
            : consent.granted_permissions
          if (Array.isArray(granted) && granted.length > 0) return granted
        } catch { /* ignore */ }
        try {
          return JSON.parse(consent.permissions || '[]')
        } catch { return [] }
      })()

      if (!effectivePermissions.includes('PAYMENTS_WRITE')) {
        return reply.status(403).send({ error: 'Forbidden', message: 'PAYMENTS_WRITE permission not granted' })
      }

      // Record transfer in Hub DB
      const transfer = await transferService.createTransfer({
        consent_id: consentId,
        bank_id: consent.bank_id,
        amount,
        currency,
        debtor_account: debtorAccount,
        creditor_account: creditorAccount,
        creditor_name: creditorName
      })

      const bankUrl = await getBankApiUrl(consent.bank_id)

      // Forward to bank adapter
      const response = await axios.post(`${bankUrl}/transfers`, {
        amount,
        currency,
        debtorAccount,
        creditorAccount,
        creditorName,
        toAccountType: creditorIdType || 'MSISDN'
      }, {
        headers: { 'Authorization': `Bearer ${consent.access_token}` }
      })

      // Update with Mojaloop tracking data
      const updatedTransfer = await transferService.updateTransfer(transfer.id, {
        mojaloop_transfer_id: response.data.mojaloopTransferId,
        party_info: response.data.partyInfo
      })

      return updatedTransfer
    } catch (err) {
      app.log.error(err)
      return reply.status(err.response?.status || 502).send(err.response?.data || { error: 'Bank communication error' })
    }
  })

  // Step 2 — Confirm Recipient (Get Quote)
  app.put('/transfers/:id/confirm-party', async (request, reply) => {
    const { id } = request.params

    try {
      const transfer = await transferService.getTransferById(id)
      if (!transfer || transfer.status !== 'INITIATED') {
        return reply.status(400).send({ error: 'Invalid transfer state' })
      }

      const consent = await consentService.getConsentById(transfer.consent_id)
      const bankUrl = await getBankApiUrl(transfer.bank_id)

      const response = await axios.put(`${bankUrl}/transfers/${transfer.mojaloop_transfer_id}/confirm-party`, 
        { acceptParty: true }, 
        { headers: { 'Authorization': `Bearer ${consent.access_token}` } }
      )

      const updatedTransfer = await transferService.updateTransfer(transfer.id, {
        status: 'PARTY_CONFIRMED',
        quote_info: response.data.quoteInfo
      })

      return updatedTransfer
    } catch (err) {
      return reply.status(502).send({ error: 'Bank communication error' })
    }
  })

  // Step 3 — Confirm Quote and Execute
  app.put('/transfers/:id/confirm-quote', async (request, reply) => {
    const { id } = request.params

    try {
      const transfer = await transferService.getTransferById(id)
      if (!transfer || transfer.status !== 'PARTY_CONFIRMED') {
        return reply.status(400).send({ error: 'Invalid transfer state' })
      }

      const consent = await consentService.getConsentById(transfer.consent_id)
      const bankUrl = await getBankApiUrl(transfer.bank_id)

      const response = await axios.put(`${bankUrl}/transfers/${transfer.mojaloop_transfer_id}/confirm-quote`, 
        { acceptQuote: true }, 
        { headers: { 'Authorization': `Bearer ${consent.access_token}` } }
      )

      const finalStatus = response.data.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED'
      const updatedTransfer = await transferService.updateTransfer(transfer.id, {
        status: finalStatus
      })

      return updatedTransfer
    } catch (err) {
      await transferService.updateTransfer(id, { status: 'FAILED' })
      return reply.status(502).send({ error: 'Transfer failed execution' })
    }
  })
}
