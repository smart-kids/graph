import express from "express"

import dataGraphRouter from "./index"
import { router } from "./auth"
import storage from "./storage"

import morgan from "morgan";

import cors from "cors"

import game_socket from "./game-events/route_files.js"

const { NODE_ENV, PORT = 3000 } = process.env;

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

    io.on("connection", function (socket) {
        // Accept a login event with user's data
        socket.on("login", function (userdata) {
            console.log(socket.id, " login")
            socket.handshake.session.userdata = userdata;
            socket.handshake.session.save();
        });
        socket.on("logout", function (userdata) {
            console.log(socket.id, " logout")
            if (socket.handshake.session.userdata) {
                delete socket.handshake.session.userdata;
                socket.handshake.session.save();
            }
        });
    });

    if (NODE_ENV !== "test") app.use(morgan("tiny"), cors());

    const db = await storage

    Object.assign(app.locals, { db })

    // app.use("/game-events", game_socket)
    app.use("/auth", router)
    app.use("/health", (req, res) => res.json({ status: "ok" }))
    app.use("/", dataGraphRouter)

    // app.use("*", (req, res) => res.send(`
    //     that url doesnt have a home here, are you lost? 

    //     <a url="/">go home </a>
    // `))
}

attatchRouter(app)

if (NODE_ENV !== "test")
    server.listen(PORT, () =>
        console.log(`School project running on port ${PORT}! on ${NODE_ENV} mode.`)
    );

app.locals.io = io

export default app;
