const axios = require('axios');
const moment = require('moment');

const createMpesaService = ({ collections, logger = console }) => {
    // M-Pesa configuration
    const mpesaConfig = {
        baseURL: process.env.MPESA_BASE_URL || 'https://api.safaricom.co.ke',
        consumerKey: process.env.MPESA_CONSUMER_KEY,
        consumerSecret: process.env.MPESA_CONSUMER_SECRET,
        shortcode: process.env.MPESA_SHORTCODE,
        passkey: process.env.MPESA_PASSKEY,
        transactionType: 'CustomerPayBillOnline',
        callbackURL: process.env.MPESA_CALLBACK_URL || 'https://your-callback-url.com/mpesa/callback',
        accountReference: process.env.MPESA_ACCOUNT_REFERENCE || 'ShulePlus',
        tokenExpiresIn: 3599 // 1 hour in seconds
    };

    // Token caching
    let tokenCache = {
        accessToken: null,
        expiresAt: null
    };

    // Get the Payment collection
    const PaymentCollection = collections.payment;

    // Helper function to generate password
    const _generatePassword = () => {
        const timestamp = moment().format('YYYYMMDDHHmmss');
        const password = Buffer.from(`${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`).toString('base64');
        return { password, timestamp };
    };

    // Get access token
    const _getAccessToken = async () => {
        try {
            const auth = Buffer.from(`${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`).toString('base64');
            
            const response = await axios.get(
                `${mpesaConfig.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`
                    }
                }
            );

            const { access_token, expires_in } = response.data;
            tokenCache = {
                accessToken: access_token,
                expiresAt: moment().add(expires_in - 60, 'seconds').toDate() // Add buffer time
            };

            return access_token;
        } catch (error) {
            logger.error('[MpesaService] Error getting access token:', error.message);
            throw new Error('Failed to authenticate with M-Pesa API');
        }
    };

    // Initiate STK Push
    const initiateSTKPush = async (initData) => {
        try {
            const { amount, phone, transactionId, userId, schoolId: school, description, accountReference } = initData;
            
            // Format phone number
            const formattedPhone = phone.replace(/^0/, '254').replace(/\+/, '');

            // 1. Create the PENDING payment record
            const paymentData = {
                id: transactionId,
                user: userId,
                school,
                phone: formattedPhone,
                amount: Number(amount),
                status: 'PENDING',
                description: description || `Payment for ${mpesaConfig.accountReference}`,
                accountReference: accountReference || mpesaConfig.accountReference,
                metadata: {
                    initiatedAt: new Date().toISOString(),
                    ...(initData.metadata || {})
                }
            };

            // Create payment record
            await PaymentCollection.create(paymentData);
            logger.info(`[MpesaService] Created PENDING payment record: ${transactionId}`);

            // 2. Get access token
            const accessToken = await _getAccessToken();
            const { password, timestamp } = _generatePassword();
            const callbackURL = `${mpesaConfig.callbackURL}/${transactionId}`;

            // 3. Prepare STK push request
            // Format amount with exactly 2 decimal places as required by M-Pesa
            const amountValue = Number(amount);
            const requestBody = {
                BusinessShortCode: mpesaConfig.shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: mpesaConfig.transactionType,
                Amount: amountValue,
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

            // 4. Make the STK push request
            const response = await axios.post(
                `${mpesaConfig.baseURL}/mpesa/stkpush/v1/processrequest`,
                requestBody,
                { 
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`, 
                        'Content-Type': 'application/json' 
                    },
                    timeout: 30000
                }
            );

            const { data } = response;
            logger.info(`[MpesaService] STK Push response for ${transactionId}:`, data);

            if (data.ResponseCode !== '0') {
                throw new Error(data.errorMessage || data.ResponseDescription || 'M-Pesa rejected the STK push request.');
            }

            // 5. Update payment with M-Pesa request IDs
            const updateData = {
                merchantRequestID: data.MerchantRequestID,
                checkoutRequestID: data.CheckoutRequestID,
                status: 'PENDING',
                metadata: {
                    ...(paymentData.metadata || {}),
                    stkPushRequest: requestBody,
                    stkPushResponse: data,
                    updatedAt: new Date().toISOString()
                }
            };

            await PaymentCollection.updateOne({ id: transactionId }).set(updateData);
            logger.info(`[MpesaService] Updated payment ${transactionId} with M-Pesa request IDs`);

            // 6. Return success response
            return {
                success: true,
                MerchantRequestID: data.MerchantRequestID,
                CheckoutRequestID: data.CheckoutRequestID,
                transactionId,
                message: 'Payment request sent. Please check your phone to complete the transaction.',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            const errorMessage = error.response?.data?.errorMessage || 
                              error.response?.data?.ResponseDescription || 
                              error.message;
            
            logger.error(`[MpesaService] STK Push failed:`, {
                error: errorMessage,
                stack: error.stack,
                response: error.response?.data
            });

            // Update payment with error state if we have a transactionId
            if (initData?.transactionId) {
                const updateData = {
                    status: 'FAILED_ON_INITIATION',
                    resultCode: error.response?.data?.ResponseCode || 'ERROR',
                    resultDesc: errorMessage,
                    errorMessage: errorMessage,
                    errorCode: error.response?.data?.ResponseCode || 'ERROR',
                    metadata: {
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
                    await PaymentCollection.updateOne({ id: initData.transactionId }).set(updateData);
                    logger.error(`[MpesaService] Updated payment ${initData.transactionId} with error state`);
                } catch (updateError) {
                    logger.error(`[MpesaService] Failed to update payment with error state:`, updateError);
                }
            }

            // Re-throw the error to be handled by the GraphQL resolver
            throw new Error(`Failed to initiate payment: ${errorMessage}`);
        }
    };

// Handle M-Pesa callback
    const handleMpesaCallback = async (callbackData) => {
        try {
            // 1. Safely extract data from the callback structure
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
                throw new Error('No CheckoutRequestID in callback data');
            }

            logger.info(`[MpesaService] Processing callback for CheckoutRequestID: ${CheckoutRequestID}`);

            // 2. Find the payment record using the unique CheckoutRequestID
            const payment = await PaymentCollection.findOne({ checkoutRequestID: CheckoutRequestID });
            
            if (!payment) {
                logger.error(`[MpesaService] Payment record not found for CheckoutRequestID: ${CheckoutRequestID}`);
                return { success: false, error: 'Payment record not found' };
            }

            // 3. Prepare the update object
            const updateData = {
                resultCode: String(ResultCode), // Ensure it's a string
                resultDesc: ResultDesc,
                merchantRequestID: MerchantRequestID,
                updatedAt: new Date().toISOString(),
                // Store the raw callback in metadata for auditing/debugging
                metadata: {
                    ...(payment.metadata || {}),
                    callback: callbackData,
                    callbackReceivedAt: new Date().toISOString()
                }
            };

            // 4. Extract specific metadata items if the transaction was successful
            // We overwrite the local data with the CONFIRMED data from M-Pesa
            if (CallbackMetadata?.Item?.length) {
                CallbackMetadata.Item.forEach(item => {
                    const value = String(item.Value);
                    
                    switch (item.Name) {
                        case 'Amount':
                            // We blindly accept M-Pesa's value because STK Push amounts are locked.
                            // This fixes the "1.00" vs "1" mismatch bug.
                            updateData.amount = value; 
                            break;
                        case 'MpesaReceiptNumber':
                            updateData.mpesaReceiptNumber = value;
                            updateData.ref = value; // Backward compatibility for UI
                            break;
                        case 'TransactionDate':
                            updateData.transactionDate = value;
                            // Format: YYYYMMDDHHmmss -> ISO String if you want, or keep raw
                            updateData.time = value; // Backward compatibility for UI
                            break;
                        case 'PhoneNumber':
                            updateData.phone = value;
                            break;
                    }
                });
            }

            // 5. Determine Final Status based on ResultCode
            const code = String(ResultCode);
            
            if (code === '0') {
                updateData.status = 'COMPLETED';
                updateData.processedAt = new Date().toISOString();
            } 
            // 1032: Cancelled by user | 1037: Timeout | 2001: Wrong PIN
            else if (['1032', '1037', '2001'].includes(code)) {
                updateData.status = 'CANCELLED';
                updateData.errorMessage = ResultDesc; // Useful for UI display
            } 
            else {
                updateData.status = 'FAILED';
                updateData.errorMessage = ResultDesc;
            }

            // 6. Update the database
            await PaymentCollection.updateOne({ id: payment.id }).set(updateData);
            
            logger.info(`[MpesaService] Payment ${payment.id} updated to status: ${updateData.status}`);

            return {
                success: true,
                paymentId: payment.id,
                status: updateData.status,
                message: ResultDesc || 'Callback processed successfully'
            };

        } catch (error) {
            logger.error('[MpesaService] Error processing M-Pesa callback:', {
                error: error.message,
                stack: error.stack,
                callbackData
            });
            
            return {
                success: false,
                error: 'Failed to process M-Pesa callback',
                details: error.message
            };
        }
    };

    // Verify transaction status
    const verifyTransaction = async (checkoutRequestID) => {
        try {
            const accessToken = await _getAccessToken();
            const { password, timestamp } = _generatePassword();
            
            const response = await axios.get(
                `${mpesaConfig.baseURL}/mpesa/stkpushquery/v1/query`,
                {
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`, 
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

    return {
        initiateSTKPush,
        handleMpesaCallback,
        verifyTransaction
    };
};

module.exports = { createMpesaService };