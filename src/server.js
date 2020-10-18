import express from "express"

import dataGraphRouter from "./index"
import { router } from "./auth"
import storage from "./storage"

import morgan from "morgan";

import cors from "cors"

const {
    FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET,
    FACEBOOK_CALLBACK,
} = process.env

const StreamTcp = require('./sockets/stream-tcp')

var passport = require('passport')
    , FacebookStrategy = require('passport-facebook').Strategy;

const tcpSplit = new StreamTcp()

const { NODE_ENV, PORT = 4000 } = process.env;

// ------------------------------------------
var app = require('express')(),
    server = require("http").createServer(app),
    io = require("socket.io")(server),
    session = require("express-session")({
        secret: "my-secret",
        resave: true,
        saveUninitialized: true
    }),
    sharedsession = require("express-socket.io-session");

const attatchRouter = async (app) => {
    // app.use("/health", (req, res) => res.json({ status: "ok" }))

    // Attach session
    app.use(session);

    // Share session with io sockets

    io.use(sharedsession(session));

    io.on("connection", require("./sockets/socket-pass"));

    if (NODE_ENV !== "test") app.use(morgan("tiny"), cors());

    const db = await storage

    Object.assign(app.locals, { db })

    // app.use("/game-events", game_socket)
    app.use("/auth", router)
    app.use("/health", (req, res) => res.json({ status: "ok" }))


    // app.use("*", (req, res) => res.send(`
    //     that url doesnt have a home here, are you lost? 

    //     <a url="/">go home </a>
    // `))


    // OAUTH STUFF
    passport.use(new FacebookStrategy({
        clientID: FACEBOOK_APP_ID,
        clientSecret: FACEBOOK_APP_SECRET,
        callbackURL: FACEBOOK_CALLBACK
    },
        function (accessToken, refreshToken, profile, done) {
            console.log({ accessToken, refreshToken, profile })
            // User.findOrCreate(..., function (err, user) {
            //     if (err) { return done(err); }
            //     done(null, user);
            // });
        }
    ));

    app.get('/auth/facebook', passport.authenticate('facebook'));

    // Facebook will redirect the user to this URL after approval.  Finish the
    // authentication process by attempting to obtain an access token.  If
    // access was granted, the user will be logged in.  Otherwise,
    // authentication has failed.
    app.get('/auth/facebook/callback',
        passport.authenticate('facebook', {
            successRedirect: '/',
            failureRedirect: '/login'
        }));


    app.use("/graph", dataGraphRouter)
}

attatchRouter(app)

if (NODE_ENV !== "test")
    server.listen(PORT, () =>
        console.log(`School project running on port ${PORT}! on ${NODE_ENV} mode.`)
    );

app.locals.io = io

export default app;
