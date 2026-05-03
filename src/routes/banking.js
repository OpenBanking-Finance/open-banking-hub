import axios from 'axios'
import db from '../db/knex.js'
import consentService from '../services/consentService.js'

export default async function bankingRoutes(app) {

  const getBankApiUrl = async (consent) => {
    const bank = await db('banks').where({ id: consent.bank_id }).first()
    return bank?.api_url || 'http://127.0.0.1:3001'
  }

  // Returns the permissions the USER actually granted (falls back to what the fintech requested
  // if the bank adapter didn't return granted_permissions — e.g. mock-bank)
  const getEffectivePermissions = (consent) => {
    try {
      const granted = typeof consent.granted_permissions === 'string'
        ? JSON.parse(consent.granted_permissions)
        : consent.granted_permissions
      if (Array.isArray(granted) && granted.length > 0) return granted
    } catch { /* ignore */ }
    try {
      const requested = typeof consent.permissions === 'string'
        ? JSON.parse(consent.permissions)
        : consent.permissions
      return Array.isArray(requested) ? requested : []
    } catch { return [] }
  }

  // GET /accounts
  app.get('/accounts', async (request, reply) => {
    const { consentId } = request.query

    if (!consentId) return reply.status(400).send({ error: 'consentId is required' })

    try {
      const consent = await consentService.getConsentById(consentId)
      if (!consent || !consent.access_token) {
        return reply.status(403).send({ error: 'Unauthorised', message: 'No valid access token found' })
      }

      if (!getEffectivePermissions(consent).includes('ACCOUNTS_READ')) {
        return reply.status(403).send({ error: 'Forbidden', message: 'ACCOUNTS_READ permission not granted' })
      }

      const bankUrl = await getBankApiUrl(consent)

      request.log.info({ bankUrl, bank_user_id: consent.bank_user_id }, 'Calling bank /accounts')

      const response = await axios.get(`${bankUrl}/accounts`, {
        headers: {
          'Authorization': `Bearer ${consent.access_token}`,
          'X-Consent-ID': consentId,
          'X-User-ID': consent.bank_user_id
        }
      })

      const data = response.data

      // Filter to only accounts the user selected during consent authorisation
      const selectedAccounts = (() => {
        if (!consent.selected_accounts) return null
        try {
          const parsed = typeof consent.selected_accounts === 'string'
            ? JSON.parse(consent.selected_accounts)
            : consent.selected_accounts
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
        } catch { return null }
      })()

      if (selectedAccounts && Array.isArray(data.accounts)) {
        data.accounts = data.accounts.filter(acc => selectedAccounts.includes(acc.id))
      }

      return data
    } catch (err) {
      return reply.status(err.response?.status || 502).send(err.response?.data || { error: 'Bank communication error' })
    }
  })

  // GET /accounts/:accountId/transactions
  app.get('/accounts/:accountId/transactions', async (request, reply) => {
    const { accountId } = request.params
    const { consentId } = request.query

    try {
      const consent = await consentService.getConsentById(consentId)
      if (!consent || !consent.access_token) return reply.status(403).send({ error: 'Unauthorised' })

      if (!getEffectivePermissions(consent).includes('TRANSACTIONS_READ')) {
        return reply.status(403).send({ error: 'Forbidden', message: 'TRANSACTIONS_READ permission not granted' })
      }

      const bankUrl = await getBankApiUrl(consent)

      const response = await axios.get(`${bankUrl}/accounts/${accountId}/transactions`, {
        headers: {
          'Authorization': `Bearer ${consent.access_token}`,
          'X-User-ID': consent.bank_user_id
        }
      })
      return response.data
    } catch (err) {
      return reply.status(502).send({ error: 'Bank communication error' })
    }
  })
}
