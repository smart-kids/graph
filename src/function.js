// Your main server file (e.g., index.js or app.js)

import express from "express"
import dataGraphRouter from "./router"
import { router as authRouter } from "./auth" // Renamed for clarity
import storage from "./storage"
import { createMpesaRouter } from "./payments" // <-- 1. IMPORT THE FACTORY FUNCTION
import { router as ai_mlRouter } from "./ai_ml" // <-- 1. IMPORT THE FACTORY FUNCTION
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

// Attach session
app.use(session);

// Share session with io sockets
io.use(sharedsession(session));

io.on("connection", require("./sockets/socket-pass"));

app.use(express.urlencoded({ extended: true, limit: '3mb' }));
app.use(express.json());
app.use(cors());
app.use(morgan(['development', "test"].includes(NODE_ENV) ? 'tiny' : 'combined'))

// You are already assigning storage and io to app.locals, which is great.
// We'll use these to initialize the router.
Object.assign(app.locals, { db: storage, io })

// Mount the routers
async function attatch() {
    app.use(["/", "/graph"], dataGraphRouter(storage))
    app.use("/auth", authRouter)
    app.use("/mpesa", await createMpesaRouter(storage, io)) // <-- 2. INITIALIZE AND MOUNT THE ROUTER
    app.use("/ai_ml", ai_mlRouter) // <-- 2. INITIALIZE AND MOUNT THE ROUTER
    app.use("/health", (req, res) => res.json({ status: "ok" }))
}

if (NODE_ENV !== "test"){
    attatch().then(() => {
        server.listen(PORT, () =>
            console.log(`School project running on port ${PORT}! on ${NODE_ENV} mode.`)
        );  
    })
}

// Export the app as a Google Cloud Function
functions.http('shuleplus-server', async (req, res) => {
    await attatch()
    app(req, res);
});

export default app;