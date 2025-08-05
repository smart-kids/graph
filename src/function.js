// index.js

// --- 1. CONFIGURATION & IMPORTS ---
import 'dotenv/config';
import express from "express";
import http from "http";
import cluster from "cluster";
import os from "os";
import { Server } from "socket.io";
import session from "express-session";
import sharedsession from "express-socket.io-session";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import cors from "cors";
import morgan from "morgan";

import bugsnagClient from "./utils/bugsnug";
const bugsnagMiddleware = bugsnagClient.getPlugin('express');

import ormPromise from "./storage";
import dataGraphRouter from "./router";
import { router as authRouter } from "./auth";
import { createMpesaRouter } from "./payments";
import { router as ai_mlRouter } from "./ai_ml";
import socketPassHandler from "./sockets/socket-pass";

// --- 2. ENVIRONMENT VALIDATION ---
const { NODE_ENV = 'development', PORT = 4000, SESSION_SECRET, CORS_ORIGIN, APP_VERSION = '1.0.0' } = process.env;

if (!SESSION_SECRET) {
    console.warn("WARNING: SESSION_SECRET is not defined. Using a default, insecure secret.");
}


// --- 3. THE TWO-PHASE APP CONFIGURATION LOGIC ---
// These functions will be used *by each worker*.

/**
 * Middleware that acts as a gatekeeper for each worker.
 * @param {boolean} isWorkerReady - A flag local to the specific worker process.
 */
const createReadinessMiddleware = (isWorkerReady) => (req, res, next) => {
    if (req.path === '/health') {
        return res.status(200).json({ status: "ok", ready: isWorkerReady });
    }
    if (!isWorkerReady) {
        return res.status(503).json({ error: "Service is starting up, please try again shortly." });
    }
    next();
};

/**
 * Attaches the main, ORM-dependent application logic to a worker's app instance.
 */
async function attachFullAppLogic(app, server, orm) {
    app.use(bugsnagMiddleware.requestHandler);

    if (NODE_ENV === 'production') {
        app.use(helmet());
        app.use(hpp());
        app.use(compression());
        app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 250, standardHeaders: true, legacyHeaders: false }));
    }
    
    app.use(mongoSanitize());
    app.use(express.json({ limit: "500kb" }));
    app.use(express.urlencoded({ extended: true, limit: '500kb' }));

    const sessionMiddleware = session({
        secret: SESSION_SECRET || 'default-insecure-secret-key',
        resave: false, saveUninitialized: false,
        cookie: { secure: NODE_ENV === 'production', httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 },
    });
    app.use(sessionMiddleware);

    const io = null;
    
    // = new Server(server, { cors: { origin: CORS_ORIGIN } });
    // io.use(sharedsession(sessionMiddleware, { autoSave: true }));
    // io.on("connection", socketPassHandler);

    Object.assign(app.locals, { db: orm.collections, io, bugsnag: bugsnagClient });

    app.use(["/", "/graph"], dataGraphRouter(orm));
    app.use("/auth", authRouter);
    app.use("/mpesa", await createMpesaRouter(orm, io));
    app.use("/ai_ml", ai_mlRouter);

    app.use(bugsnagMiddleware.errorHandler);
    app.use((err, req, res, next) => {
        if (NODE_ENV !== 'test') console.error(`[Worker ${process.pid}] Error:`, err.stack);
        if (!res.headersSent) res.status(500).json({ error: "An unexpected internal server error occurred." });
    });

    console.log(`[Worker ${process.pid}] ✅ Main application logic has been attached.`);
}


// --- 4. MODE-BASED EXECUTION LOGIC ---

// PRIMARY PROCESS: Manages the workers. Does not run the app itself.
if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;
    console.log(`[Primary] PID ${process.pid} is running in ${NODE_ENV} mode.`);
    console.log(`[Primary] Forking server for ${numCPUs} CPUs...`);

    // CRITICAL: Remove debugging flags before forking workers to prevent port conflicts.
    const debugArgRegex = /--inspect(?:-brk)?(?:=\S+)?/;
    cluster.setupPrimary({ execArgv: process.execArgv.filter(arg => !debugArgRegex.test(arg)) });

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
        console.error(`[Primary] Worker ${worker.process.pid} died. Code: ${code}, Signal: ${signal}.`);
        bugsnagClient.notify(new Error(`Worker ${worker.process.pid} died unexpectedly.`));
        console.log("[Primary] Starting a new worker...");
        cluster.fork();
    });

// WORKER PROCESS: Each worker runs its own two-phase startup.
} else {
    // This self-invoking async function encapsulates the entire worker's lifecycle.
    (async () => {
        // State flag local to *this worker process only*.
        let isReady = false;
        // The initialized ORM instance for this worker.
        let orm = null;

        const app = express();
        const server = http.createServer(app);
        
        // --- PHASE 1: WORKER'S IMMEDIATE STARTUP ---
        app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
        app.use(createReadinessMiddleware(isReady)); // The gatekeeper uses the local isReady flag.
        
        server.listen(PORT, () => {
            console.log(`[Worker ${process.pid}] 🚀 Is now LISTENING on port ${PORT}.`);
            console.log(`[Worker ${process.pid}] 🚦 Service is in startup mode, not yet ready.`);
        });

        // --- PHASE 2: WORKER'S BACKGROUND INITIALIZATION ---
        try {
            console.log(`[Worker ${process.pid}] ⏳ Initializing dependencies (Waterline ORM)...`);
            orm = await ormPromise;
            
            await attachFullAppLogic(app, server, orm);

            isReady = true; // Flip the switch for this worker.
            console.log(`[Worker ${process.pid}] ✅ Service is now fully ready and accepting traffic.`);

        } catch (err) {
            console.error(`[Worker ${process.pid}] ❌ FATAL ERROR during background initialization.`, err);
            bugsnagClient.notify(err);
            // Gracefully stop this worker so the primary can restart it.
            process.exit(1);
        }
        
        // --- GRACEFUL SHUTDOWN FOR THIS WORKER ---
        const signals = ['SIGINT', 'SIGTERM'];
        signals.forEach(signal => {
            process.on(signal, () => {
                console.log(`\n[Worker ${process.pid}] Received ${signal}, shutting down gracefully...`);
                server.close(async () => {
                    console.log(`[Worker ${process.pid}] HTTP server closed.`);
                    // Only try to tear down the ORM if it was successfully initialized.
                    if (orm) {
                        await orm.teardown();
                        console.log(`[Worker ${process.pid}] Database connections closed.`);
                    }
                    console.log(`[Worker ${process.pid}] Process exited.`);
                    process.exit(0);
                });
            });
        });
    })();
}