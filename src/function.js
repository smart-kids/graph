import express from "express"

import dataGraphRouter from "./router"
import { router } from "./auth"
import storage from "./storage"

import morgan from "morgan";

import cors from "cors"

const StreamTcp = require('./sockets/stream-tcp')

const tcpSplit = new StreamTcp()
const functions = require('@google-cloud/functions-framework');

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

// const attatchRouter = async (app) => {
// app.use("/health", (req, res) => res.json({ status: "ok" }))

// Attach session
app.use(session);

// Share session with io sockets

io.use(sharedsession(session));

io.on("connection", require("./sockets/socket-pass"));

app.use(express.urlencoded({ extended: true, limit: '3mb' }));
app.use(express.json());
app.use(cors());
app.use(morgan(['development', "test"].includes(NODE_ENV) ? 'tiny' : 'combined'))

Object.assign(app.locals, { db: storage, io })

app.use(["/", "/graph"], dataGraphRouter(storage))

// app.use("/game-events", game_socket)
app.use("/auth", router)
app.use("/health", (req, res) => res.json({ status: "ok" }))


// app.use("*", (req, res) => res.send(`
//     that url doesnt have a home here, are you lost? 

//     <a url="/">go home </a>
// `))
// }


if (NODE_ENV !== "test")
    server.listen(PORT, () =>
        console.log(`School project running on port ${PORT}! on ${NODE_ENV} mode.`)
    );

// export default app;
// Export the app as a Google Cloud Function
functions.http('shuleplus-server', (req, res) => {
    app(req, res);  // Handle requests with Express
});


export default app;