import axios from 'axios'
import db from '../db/knex.js'
import consentService from '../services/consentService.js'

export default async function consentRoutes(app) {
  // Get list of available banks from the Directory
  app.get('/banks', async (request, reply) => {
    const banks = await db('banks').where({ status: 'active' })
    return banks
  })

  // Create a new consent request
  app.post('/consents', async (request, reply) => {
    try {
      const body = request.body || {}
      const { permissions, expiration_date, bank_id } = body

      const userId = "dev-user-tester"

      // 1. RESOLVE BANK FROM DIRECTORY (DB)
      const bank = await db('banks').where({ id: bank_id || '3001' }).first()
      if (!bank) return reply.status(404).send({ error: 'Bank not found in directory' })

      const consent = await consentService.createConsent({
        user_id: userId,
        bank_id: bank.id,
        permissions: permissions || [],
        expiration_date: expiration_date
      })

      // Use the official authorise_url from the Directory
      const hubUrl = process.env.HUB_PUBLIC_URL || 'http://127.0.0.1:3000'
      const authorisationUri = `${bank.authorise_url}?consentId=${consent.id}&redirect_uri=${hubUrl}/consents/callback`

      request.log.info({ consentId: consent.id, bank: bank.name }, 'New consent request created via Directory')

      return reply.status(201).send({
        ...consent,
        redirect_url: authorisationUri
      })
    } catch (err) {
      request.log.error(err, 'Failed to create consent')
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })

  // Callback route to receive authorization status from the Bank
  // GET /consents/callback
  app.get('/consents/callback', async (request, reply) => {
    const { consentId, code, status } = request.query

    // Handle user rejection at the bank
    if (status === 'REJECTED') {
      await consentService.updateAuthorizedConsent(consentId, { status: 'REJECTED' })
      return reply.send({
        message: "Consent rejected by the user at the bank.",
        status: "REJECTED"
      })
    }

    if (!code) {
      return reply.status(400).send({ error: 'Authorization code missing' })
    }

    try {
      // 1. Fetch consent to identify the target bank
      const consent = await consentService.getConsentById(consentId)
      if (!consent) return reply.status(404).send({ error: 'Consent not found' })

      // 2. EXCHANGE CODE FOR TOKEN
      const bank = await db('banks').where({ id: consent.bank_id }).first()
      const bankUrl = bank?.api_url || 'http://127.0.0.1:3001'

      request.log.info({ consentId, code }, 'Starting code exchange for token at the bank')

      const tokenResponse = await axios.post(`${bankUrl}/token`, {
        code,
        client_id: 'hub_client_001',
        client_secret: 'super_secret_hub_key'
      })

      const { access_token, refresh_token, bank_user_id } = tokenResponse.data

      // 3. Persist tokens and update status to AUTHORISED
      await consentService.updateAuthorizedConsent(consentId, {
        status: 'AUTHORISED',
        access_token,
        refresh_token,
        bank_user_id
      })

      // 4. Redirect user back to the Fintech Portal (App)
      const portalUrl = process.env.APP_PORTAL_URL || 'http://127.0.0.1:5000/';
      return reply.redirect(`${portalUrl}?consentId=${consentId}`)

    } catch (err) {
      request.log.error(err, 'Token exchange failed')
      return reply.status(502).send({
        error: "Bank communication failure",
        message: err.message
      })
    }
  })

  // Get consent status
  // GET /consents/:consentId
  app.get('/consents/:consentId', async (request, reply) => {
    const { consentId } = request.params

    try {
      const consent = await consentService.getConsentById(consentId)

      if (!consent) {
        return reply.status(404).send({ error: 'Consent not found' })
      }

      return consent
    } catch (err) {
      request.log.error(err, 'Failed to fetch consent')
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
  })
}
