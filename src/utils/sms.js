var request = require("request");
// Require `PhoneNumberFormat`.
const PNF = require('google-libphonenumber').PhoneNumberFormat;

// Get an instance of `PhoneNumberUtil`.
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

function makeid() {
    var text = "";
    var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 4; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

const func = ({ data: { submited, project } }, reply) => {
    const number = phoneUtil.parseAndKeepRawInput(submited.__agentPhoneNumber, 'KE');
    const coolNumber = phoneUtil.format(number, PNF.E164)

    const Body = `test`

    const options = {
        method: 'POST',
        url: 'https://account.mobilesasa.com/api/express-post',
        headers:
        {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json'
        },
        form:
        {
            api_key:
                '$2y$10$lvLytGxvwzQkFN78K3ke7.2MFU.Mu9FWI35NNFzMeut/VxKgZSGR.',
            senderID: 'MOBILESASA',
            phone: coolNumber,
            message: Body,
            username: 'branson'
        }
    }

    request(options, function (error, response, body) {
        if (error) throw new Error(error);
        console.log(JSON.stringify(JSON.parse(body), null, '\t'))
        reply();
    });

}


// tests

// console.log(makeid())
// func({ data: { password: makeid(), phone: "+254711657108" } }, console.log)

module.exports = func