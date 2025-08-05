// FILE: api/services/createMpesaService.js

const axios = require('axios');
const moment = require('moment');
var request = require("request-promise");
require('dotenv').config()
const base64 = require('base64-js');
// The token cache can remain at the module level, as the token is typically
// app-wide and not specific to a single request.
let tokenCache = {
    accessToken: null,
    expiresAt: null,
};


const mpesaConfig = {
    // Use the sandbox URL for testing, or the live URL for production.
    // Sandbox: 'https://sandbox.safaricom.co.ke'
    // Live: 'https://api.safaricom.co.ke'
    baseURL: process.env.MPESA_BASE_URL,

    // Your app's Consumer Key and Consumer Secret from the Daraja portal.
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,

    // The Lipa Na M-Pesa Online Shortcode. For sandbox, this is usually 831...
    shortcode: process.env.MPESA_SHORTCODE,

    // The passkey for your shortcode from the Daraja portal.
    passkey: process.env.MPESA_PASSKEY,

    // The type of transaction. 'CustomerPayBillOnline' or 'CustomerBuyGoodsOnline'
    transactionType: 'CustomerPayBillOnline',

    // The URL that Safaricom will post the callback to.
    // This MUST be a publicly accessible HTTPS URL. Use ngrok for local testing.
    // It must point to the router we created earlier.
    callbackURL: process.env.MPESA_CALLBACK_URL,

    // The account reference. Can be your company name or a product name.
    accountReference: 'ShulePlus'
}


function pad2(n) {
    return n < 10 ? "0" + n : n;
}

/**
 * Creates an instance of the M-Pesa service.
 * This factory pattern allows us to inject dependencies (config, db collections, logger),
 * making the service completely independent of the Sails global object.
 *
 * @param {object} dependencies - The dependencies needed by the service.
 * @param {object} dependencies.mpesaConfig - The M-Pesa configuration object (previously sails.config.custom.mpesa).
 * @param {object} dependencies.collections - The Waterline collections object from the database connection.
 * @param {object} [dependencies.logger=console] - A logger object (e.g., sails.log or Winston). Defaults to console.
 * @returns {object} An M-Pesa service instance with an `initiateSTKPush` method.
 */
const createMpesaService = ({ collections, logger = console }) => {
    console.log({ mpesaConfig })
    // Get the specific Waterline collection model once.
    const PaymentCollection = collections.payment;

    /**
     * Generates a base64 encoded password for STK Push requests.
     * This is now an internal helper function within the factory's scope.
     */
    const _generatePassword = () => {
        const timestamp = moment().format('YYYYMMDDHHmmss'); // Using moment is cleaner
        const originCredentials = `${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`;

        // Use the built-in Node.js Buffer to correctly encode the string to Base64
        const password = Buffer.from(originCredentials).toString('base64');

        console.log(`[MpesaService] Generated password for timestamp ${timestamp}`);
        return { password, timestamp };
    };

    /**
     * Fetches an OAuth access token from Safaricom.
     * This is also an internal helper function.
     */
    const _getAccessToken = async () => {
        const EXPIRES_IN_SAFETY_BUFFER = 60;
        const EXPIRES_IN_MS = 1000 * (mpesaConfig.tokenExpiresIn - EXPIRES_IN_SAFETY_BUFFER);

        if (tokenCache.accessToken && moment().isBefore(tokenCache.expiresAt)) {
            return tokenCache.accessToken;
        }

        logger.info('[MpesaService] No valid token in cache. Requesting new token...');

        try {
            const requestOptions = {
                url:
                    `${mpesaConfig.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
                auth: {
                    user: mpesaConfig.consumerKey,
                    pass: mpesaConfig.consumerSecret
                }
            }

            console.log(requestOptions)

            const res = await request(requestOptions);

            const { access_token, expires_in } = JSON.parse(res);
            tokenCache.accessToken = access_token;
            // Set the expiry time to be now + (duration - 60 seconds)
            tokenCache.expiresAt = moment().add(expires_in - 60, 'seconds');

            logger.info('[MpesaService] Successfully obtained new M-Pesa token.');
            return access_token;
        } catch (error) {
            console.log("[MpesaService] Error getting access token:", error)
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            logger.error(`[MpesaService] Failed to get M-Pesa token: ${errorMessage}`);
            throw new Error('M-Pesa authentication failed. Could not obtain access token.');
        }
    };

    /**
     * Initiates an STK Push and handles the entire initial database state management.
     * This is the main public method exposed by the factory.
     */
    const initiateSTKPush = async (initData) => {
        console.log({ initData })
        const { amount, phone, transactionId, userId, schoolId: school } = initData;
        // 1. Create the PENDING payment record immediately using the injected collection.
        const paymentData = { id: transactionId, userId, school, phone, amount, status: 'PENDING' };
        await PaymentCollection.create(paymentData);
        logger.info(`[MpesaService] Created PENDING payment record: ${transactionId}`);

        try {
            const formattedPhone = phone.replace(/^0/, '254').replace('+', '');
            const accessToken = await _getAccessToken();
            const { password, timestamp } = _generatePassword();
            const callbackURL = `${mpesaConfig.callbackURL}/${transactionId}`;

            const body = {
                BusinessShortCode: mpesaConfig.shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: mpesaConfig.transactionType,
                Amount: String(amount),
                PartyA: formattedPhone,
                PartyB: mpesaConfig.shortcode,
                PhoneNumber: formattedPhone,
                CallBackURL: callbackURL,
                AccountReference: mpesaConfig.accountReference,
                TransactionDesc: `Payment for ${mpesaConfig.accountReference} #${transactionId}`,
            };
            console.log(body)

            console.log("[MpesaService] attempting to use accessToken", accessToken)

            logger.info(`[MpesaService] Initiating STK Push for TxID ${transactionId} to ${formattedPhone}`);
            const response = await axios.post(
                `${mpesaConfig.baseURL}/mpesa/stkpush/v1/processrequest`,
                body,
                { headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' } }
            );

            console.log("[MpesaService] STK Push response:", response.data)

            if (response.data.ResponseCode !== '0') {
                throw new Error(response.data.ResponseDescription || 'M-Pesa rejected the STK push request.');
            }

            logger.info(`[MpesaService] STK Push accepted by Safaricom for TxID ${transactionId}`);

            const { MerchantRequestID, CheckoutRequestID, id:school } = response.data;
            // 2. On success, update the record with M-Pesa's request IDs.
            // In createMpesaService.js
            PaymentCollection.updateOne({ id: transactionId })
            .set({
               merchantRequestID: MerchantRequestID,
               checkoutRequestID: CheckoutRequestID,
               status: 'PENDING',
            })
            .then(() => logger.info('Update successful'))
            .catch(err => logger.error('Update failed:', err));

            return {
                success: true,
                merchantRequestID: MerchantRequestID,
                checkoutRequestID: CheckoutRequestID,
                message: 'Request sent. Please complete the transaction on your phone.',
                transactionId,
            };

        } catch (error) {
            console.log("[MpesaService] STK Push failed for TxID", transactionId, error)
            const errorMessage = error.response?.data?.errorMessage || error.message;
            logger.error(`[MpesaService] STK Push failed for TxID ${transactionId}: ${errorMessage}`);

            // 3. On failure, update the record to a failed state.
            PaymentCollection.updateOne({ id: transactionId }).set({
                status: 'FAILED_ON_INITIATION',
                errorMessage: errorMessage,
            });

            return {
                success: false,
                message: 'Could not initiate payment. Please try again later.',
                transactionId: null,
            };
        }
    };

    // Return the public API for the service instance.
    return {
        initiateSTKPush,
    };
};

module.exports = { createMpesaService };