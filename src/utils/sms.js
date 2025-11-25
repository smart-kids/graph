// in /Users/_bran/ShulePlus/graph/src/utils/sms.js

const axios = require("axios");
const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

/**
 * A dual-interface function to send an SMS.
 * It supports both modern async/await (returns a Promise) and
 * traditional Node.js callbacks.
 *
 * @param {object} args - The arguments object containing { schoolId, data: { phone, message } }.
 * @param {function} [callback] - Optional. A standard Node.js callback `(error, result) => {}`.
 * @returns {Promise|void} Returns a Promise if no callback is provided.
 */
const func = (args, callback) => {
    // --- Core async logic is moved into an inner function ---
    const _sendSmsInternal = async () => {
        const { phone, message } = args.data;
        try {
            const number = phoneUtil.parseAndKeepRawInput(phone, 'KE');
            const formattedNumber = phoneUtil.format(number, PNF.E164);

            const apiData = new URLSearchParams();
            apiData.append('senderID', 'SHULEPLUS');
            apiData.append('phone', formattedNumber);
            apiData.append('message', message);

            console.log(`[SMS Service] Sending message to ${formattedNumber}`);

            const response = await axios.post(
                'https://api.mobilesasa.com/v1/send/message',
                apiData,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': 'Bearer QEAVBBLs2GsjN4OaQlRCW9o2nTVnZrTV509hOjG7leCZ3tD3ZSpdPFiPskqA',
                    }
                }
            );
            
            console.log("[SMS Service] Success:", response.data);
            return response.data; // This will be the success result

        } catch (error) {
            let errorMessage = 'Failed to send SMS';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
                console.error("[SMS Service] FAILED to send SMS:", errorMessage);
            } else if (error.message) {
                errorMessage = error.message;
                console.error("[SMS Service] ERROR:", errorMessage);
            }
            
            if (error.response) {
                console.error("API Error Status:", error.response.status);
                const errorBody = typeof error.response.data === 'string' 
                    ? error.response.data.substring(0, 200) + '...' 
                    : error.response.data;
                console.error("API Error Body:", errorBody);
            } else if (error.request) {
                console.error("Network Error: No response received.", error.request);
            }
            
            // Create a new error with the proper message and include the response
            const smsError = new Error(errorMessage);
            smsError.response = error.response;
            throw smsError;
        }
    };

    // --- Interface Handling Logic ---

    // 1. Check if a callback function was provided.
    if (callback && typeof callback === 'function') {
        // Callback path
        _sendSmsInternal()
            .then(result => {
                // Node.js callback convention: (error, result)
                callback(null, result);
            })
            .catch(error => {
                // Node.js callback convention: (error, result)
                callback(error, null);
            });
        // When using a callback, the function doesn't return anything.
        return; 
    }

    // 2. If no callback, return a Promise.
    // This is the async/await path. We add a .catch to it to ensure
    // it returns `null` on failure, just like your previous version,
    // so it won't crash the calling async function.
    return _sendSmsInternal().catch(error => {
        // The error is already logged by the internal function.
        // We just swallow it here and return null to prevent a crash.
        return null;
    });
};

module.exports = func;