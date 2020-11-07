//require
var express = require("express"),
    router = express.Router(),
    smtpTransport = require('nodemailer-smtp-transport');//setup nodemailer
const nodemailer = require('nodemailer');
let transporter = nodemailer.createTransport(smtpTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
        user: 'gitomehbranson@gmail.com',
        pass: '##########'
    }
}));

const mailOptions = {
    from: "gitomehbranson@gmail.com",
    to: "sirbranson67@gmail.com",                  
    subject: "subject",       
    html: "message"          
}; 

transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
        console.log(error);
    } else {
        console.log('Email sent: ' + info.response);
    }
});

