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
    // Constants for payment statuses
    const PAYMENT_STATUS = {
        PENDING: 'PENDING',
        COMPLETED: 'COMPLETED',
        FAILED: 'FAILED',
        CANCELLED: 'CANCELLED',
        FAILED_ON_INITIATION: 'FAILED_ON_INITIATION'
    };
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
        const { amount, phone, transactionId, userId, schoolId: school, description, accountReference } = initData;
        
        // Format phone number to standard format (254XXXXXXXXX)
        const formattedPhone = phone.replace(/^0/, '254').replace(/\+/, '');
        
        // 1. Create the PENDING payment record immediately
        const paymentData = {
            id: transactionId,
            user: userId,
            school,
            phone: formattedPhone,
            amount: Number(amount),
            status: 'PENDING',
            description: description || `Payment for ${mpesaConfig.accountReference}`,
            accountReference: accountReference || mpesaConfig.accountReference,
            createdAt: moment().toISOString(),
            updatedAt: moment().toISOString(),
            metadata: {
                initiatedAt: new Date().toISOString(),
                ...(initData.metadata || {})
            }
        };

        try {
            // Create the payment record
            await PaymentCollection.create(paymentData);
            logger.info(`[MpesaService] Created PENDING payment record: ${transactionId}`);

            // 2. Initiate STK Push
            const accessToken = await _getAccessToken();
            const { password, timestamp } = _generatePassword();
            const callbackURL = `${mpesaConfig.callbackURL}/${transactionId}`;

            const requestBody = {
                BusinessShortCode: mpesaConfig.shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: mpesaConfig.transactionType,
                Amount: String(Math.ceil(amount)), // Ensure amount is a whole number
                PartyA: formattedPhone,
                PartyB: mpesaConfig.shortcode,
                PhoneNumber: formattedPhone,
                CallBackURL: callbackURL,
                AccountReference: accountReference || mpesaConfig.accountReference,
                TransactionDesc: `Payment for ${accountReference || mpesaConfig.accountReference} #${transactionId}`,
            };

            logger.info(`[MpesaService] Initiating STK Push for TxID ${transactionId} to ${formattedPhone}`, {
                amount,
                accountReference: accountReference || mpesaConfig.accountReference
            });

            const response = await axios.post(
                `${mpesaConfig.baseURL}/mpesa/stkpush/v1/processrequest`,
                requestBody,
                { 
                    headers: { 
                        'Authorization': 'Bearer ' + accessToken, 
                        'Content-Type': 'application/json' 
                    },
                    timeout: 30000 // 30 seconds timeout
                }
            );

            logger.info(`[MpesaService] STK Push response for ${transactionId}:`, response.data);

            if (response.data.ResponseCode !== '0') {
                throw new Error(response.data.errorMessage || response.data.ResponseDescription || 'M-Pesa rejected the STK push request.');
            }

            const { MerchantRequestID, CheckoutRequestID } = response.data;
            
            // 3. Update the payment record with M-Pesa's request IDs
            const updateData = {
                merchantRequestID: MerchantRequestID,
                checkoutRequestID: CheckoutRequestID,
                status: 'PENDING',
                updatedAt: new Date().toISOString(),
                metadata: {
                    ...(paymentData.metadata || {}),
                    stkPushRequest: requestBody,
                    stkPushResponse: response.data,
                    updatedAt: new Date().toISOString()
                }
            };

            await PaymentCollection.updateOne({ id: transactionId }).set(updateData);
            logger.info(`[MpesaService] Updated payment ${transactionId} with M-Pesa request IDs`);

            return {
                success: true,
                MerchantRequestID,
                CheckoutRequestID,
                transactionId,
                message: 'Payment request sent. Please check your phone to complete the transaction.',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            const errorMessage = error.response?.data?.errorMessage || 
                              error.response?.data?.ResponseDescription || 
                              error.message;
            
            logger.error(`[MpesaService] STK Push failed for TxID ${transactionId}:`, {
                error: errorMessage,
                stack: error.stack,
                response: error.response?.data
            });

            // Update the payment record with error details
            const updateData = {
                status: 'FAILED_ON_INITIATION',
                resultCode: error.response?.data?.ResponseCode || 'ERROR',
                resultDesc: errorMessage,
                errorMessage: errorMessage,
                errorCode: error.response?.data?.ResponseCode || 'ERROR',
                updatedAt: new Date().toISOString(),
                metadata: {
                    ...(paymentData.metadata || {}),
                    error: {
                        message: errorMessage,
                        code: error.response?.data?.ResponseCode,
                        stack: error.stack,
                        response: error.response?.data
                    },
                    updatedAt: new Date().toISOString()
                }
            };

            try {
                await PaymentCollection.updateOne({ id: transactionId }).set(updateData);
                logger.error(`[MpesaService] Updated payment ${transactionId} with error state`);
            } catch (updateError) {
                logger.error(`[MpesaService] Failed to update payment ${transactionId} with error state:`, updateError);
            }

            return {
                success: false,
                transactionId,
                error: errorMessage,
                errorCode: error.response?.data?.ResponseCode || 'ERROR',
                message: 'Could not initiate payment. ' + (errorMessage || 'Please try again later.')
            };
        }
    };

    /**
     * Verifies a transaction using the CheckoutRequestID
     * @param {string} checkoutRequestID - The checkout request ID from M-Pesa
     * @returns {Promise<object>} The transaction status and details
     */
    const verifyTransaction = async (checkoutRequestID) => {
        try {
            const accessToken = await _getAccessToken();
            const { password, timestamp } = _generatePassword();
            
            const response = await axios.get(
                `${mpesaConfig.baseURL}/mpesa/stkpushquery/v1/query`,
                {
                    headers: { 
                        'Authorization': 'Bearer ' + accessToken, 
                        'Content-Type': 'application/json' 
                    },
                    params: {
                        BusinessShortCode: mpesaConfig.shortcode,
                        Password: password,
                        Timestamp: timestamp,
                        CheckoutRequestID: checkoutRequestID
                    }
                }
            );

            const { ResultCode, ResultDesc, ResultData } = response.data;
            
            // Parse the result data if it exists
            let parsedData = {};
            if (ResultData) {
                try {
                    parsedData = JSON.parse(ResultData);
                } catch (e) {
                    logger.warn(`[MpesaService] Could not parse ResultData: ${e.message}`);
                }
            }

            return {
                success: ResultCode === '0',
                resultCode: ResultCode,
                resultDesc: ResultDesc,
                ...parsedData
            };
        } catch (error) {
            logger.error(`[MpesaService] Error verifying transaction: ${error.message}`);
            return {
                success: false,
                error: error.message,
                resultCode: 'ERROR',
                resultDesc: 'Error verifying transaction'
            };
        }
    };

    /**
     * Handles M-Pesa callback and updates the payment status
     * @param {object} callbackData - The callback data from M-Pesa
     * @returns {Promise<object>} The result of the operation
     */
    const handleMpesaCallback = async (callbackData) => {
        const { 
            Body: { 
                stkCallback: {
                    ResultCode,
                    ResultDesc,
                    CallbackMetadata,
                    MerchantRequestID,
                    CheckoutRequestID
                } = {} 
            } = {} 
        } = callbackData;

        if (!CheckoutRequestID) {
            logger.error('[MpesaService] No CheckoutRequestID in callback data');
            return { success: false, error: 'Invalid callback data' };
        }

        try {
            // Find the payment record
            const payment = await PaymentCollection.findOne({ checkoutRequestID: CheckoutRequestID });
            
            if (!payment) {
                logger.error(`[MpesaService] Payment not found for CheckoutRequestID: ${CheckoutRequestID}`);
                return { success: false, error: 'Payment not found' };
            }

            // Parse the callback metadata if available
            let amount = payment.amount;
            let mpesaReceiptNumber = null;
            let transactionDate = null;
            let phoneNumber = null;

            if (CallbackMetadata && CallbackMetadata.Item) {
                CallbackMetadata.Item.forEach(item => {
                    if (item.Name === 'Amount') amount = item.Value;
                    if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
                    if (item.Name === 'TransactionDate') transactionDate = item.Value;
                    if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
                });
            }

            // Determine the status based on the result code
            let status;
            if (ResultCode === '0') {
                status = PAYMENT_STATUS.COMPLETED;
            } else if (['1032', '1037'].includes(ResultCode)) {
                status = PAYMENT_STATUS.CANCELLED;
            } else {
                status = PAYMENT_STATUS.FAILED;
            }

            // Update the payment record
            const updateData = {
                status,
                resultCode: ResultCode,
                resultDesc: ResultDesc,
                ...(mpesaReceiptNumber && { mpesaReceiptNumber }),
                ...(transactionDate && { transactionDate }),
                ...(phoneNumber && { phone: phoneNumber }),
                processedAt: new Date().toISOString()
            };

            await PaymentCollection.updateOne({ id: payment.id }).set(updateData);
            
            logger.info(`[MpesaService] Updated payment ${payment.id} status to ${status}`);
            
            return {
                success: true,
                paymentId: payment.id,
                status,
                mpesaReceiptNumber,
                message: ResultDesc
            };
        } catch (error) {
            logger.error(`[MpesaService] Error processing M-Pesa callback: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    };

    // Return the public API for the service instance.
    return {
        initiateSTKPush,
        verifyTransaction,
        handleMpesaCallback
    };
};

module.exports = { createMpesaService };