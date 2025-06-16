var request = require("request");
// Require `PhoneNumberFormat`.
const PNF = require('google-libphonenumber').PhoneNumberFormat;

// Get an instance of `PhoneNumberUtil`.
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

const func = ({ schoolId, data: { phone, message } }) => {
    const number = phoneUtil.parseAndKeepRawInput(phone, 'KE');
    const formattedNumber = phoneUtil.format(number, PNF.E164)

    const options = {
        method: 'POST',
        url: 'https://api.mobilesasa.com/v1/send/message',
        headers:
        {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
            "Authorization": "Bearer QEAVBBLs2GsjN4OaQlRCW9o2nTVnZrTV509hOjG7leCZ3tD3ZSpdPFiPskqA"
        },
        form:
        {
            senderID: 'SHULEPLUS',
            phone: formattedNumber,
            message
        }
    }

    return new Promise((resolve, reject) => {
        request(options, function (error, response, body) {
            if (error) reject(error);
            else resolve(JSON.parse(body));
        });
    });
}


// tests

// console.log(makeid())
// func({ data: { password: makeid(), phone: "+254711657108" } }, console.log)

// sms({ data: { phone: "+254719420491", message:"Hello" }}, console.log)

module.exports = func