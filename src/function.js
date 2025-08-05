// index.js

// --- 1. CONFIGURATION & IMPORTS ---
import 'dotenv/config';

// Core Modules
import express from "express";
import http from "http";
import os from "os";

// Server & Middleware
import { Server } from "socket.io";
import session from "express-session";
// import sharedsession from "express-socket-io-session";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import cors from "cors";
import morgan from "morgan";

// Application & Error Reporting
import bugsnagClient from "./utils/bugsnug";
const bugsnagMiddleware = bugsnagClient.getPlugin('express');
import ormPromise from "./storage";
import dataGraphRouter from "./router";
import { router as authRouter } from "./auth";
import { createMpesaRouter } from "./payments";
import { router as ai_mlRouter } from "./ai_ml";
import socketPassHandler from "./sockets/socket-pass";

// --- 2. ENVIRONMENT VALIDATION ---
const {
    NODE_ENV = 'development',
    PORT = 4000,
    SESSION_SECRET,
    CORS_ORIGIN,
    APP_VERSION = '1.0.0'
} = process.env;

// Fail fast in production if a secret is not provided.
if (NODE_ENV === 'production' && !SESSION_SECRET) {
    throw new Error("FATAL ERROR: SESSION_SECRET is not defined in environment variables.");
}

// --- 3. CORE APPLICATION FACTORY ---
// This function configures the Express application.
async function createApp(server, orm) {
    const app = express();

    // A) Bugsnag request handler (must be first)
    app.use(bugsnagMiddleware.requestHandler);

    // B) Set security headers and enable trust for proxies (like on Sevalla)
    app.set('trust proxy', 1);
    app.use(helmet());
    
    // C) CORS Configuration
    app.use(cors({
        origin: CORS_ORIGIN,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        credentials: true
    }));

    // D) Other Security & Performance Middleware
    if (NODE_ENV === 'production') {
        app.use(hpp());
        app.use(compression());
        app.use(rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 200, // Limit each IP to 200 requests per window
            standardHeaders: true,
            legacyHeaders: false,
        }));
    }
    app.use(mongoSanitize());
    
    // E) Body Parsers & Request Logging
    app.use(express.json({ limit: "500kb" }));
    app.use(express.urlencoded({ extended: true, limit: '500kb' }));
    if (NODE_ENV !== 'test') {
        app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
    }

    // F) Session Management with MemoryStore
    // #####################################################################################
    // ### WARNING: MemoryStore is for development or single-instance deployments only.  ###
    // ### If you scale your application to run on multiple instances (e.g., more than    ###
    // ### one "dyno" on your platform), user sessions will be lost. You will need to    ###
    // ### switch to a shared store like Redis (`connect-redis`) at that time.          ###
    // #####################################################################################
    const sessionMiddleware = session({
        secret: SESSION_SECRET || 'a-strong-default-secret-for-development',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
        },
    });
    app.use(sessionMiddleware);

    // G) Socket.IO setup
    const io = null;
    // new Server(server, { cors: { origin: CORS_ORIGIN } });
    // io.use(sharedsession(sessionMiddleware, { autoSave: true }));
    // io.on("connection", socketPassHandler);

    // H) Application state and routing
    Object.assign(app.locals, { db: orm.collections, io, bugsnag: bugsnagClient });

    app.use("/health", (req, res) => res.status(200).json({ status: "ok" }));
    app.use(["/", "/graph"], dataGraphRouter(orm));
    app.use("/auth", authRouter);
    app.use("/mpesa", await createMpesaRouter(orm, io));
    app.use("/ai_ml", ai_mlRouter);

    // I) Final error handling middleware (must be last)
    app.use(bugsnagMiddleware.errorHandler);
    app.use((err, req, res, next) => {
        if (NODE_ENV !== 'test') console.error(err.stack);
        if (!res.headersSent) {
            res.status(500).json({ error: "An unexpected internal server error occurred." });
        }
    });

    return app;
}


// --- 4. SERVER STARTUP LOGIC ---
// This is the single entry point. It will run only if the file is executed directly.
if (NODE_ENV !== 'test') {
    (async () => {
        let orm;
        try {
            // 1. Initialize dependencies. This is the slowest part.
            console.log("Initializing dependencies (Waterline ORM)...");
            orm = await ormPromise;
            console.log("Waterline ORM is ready.");

            // 2. Create the server and the main app logic.
            const server = http.createServer();
            const app = await createApp(server, orm);
            server.on('request', app); // Attach app to handle requests

            // 3. Start listening on the port. This happens *after* the ORM is ready.
            // The platform timeout needs to be long enough to allow for this initialization.
            server.listen(PORT, () => {
                console.log(`✅ Server process ${process.pid} started successfully.`);
                console.log(`🚀 Listening on http://localhost:${PORT} in ${NODE_ENV} mode.`);
            });

            // 4. Set up graceful shutdown logic.
            const signals = ['SIGINT', 'SIGTERM'];
            signals.forEach(signal => {
                process.on(signal, () => {
                    console.log(`\nReceived ${signal}, shutting down gracefully...`);
                    server.close(async () => {
                        console.log("HTTP server closed.");
                        // Only try to close the DB connection if the ORM initialized successfully.
                        if (orm) await orm.teardown();
                        console.log("Process exited.");
                        process.exit(0);
                    });
                });
            });

        } catch (err) {
            console.error("❌ FATAL ERROR: Server failed to start.", err);
            bugsnagClient.notify(err);
            process.exit(1);
        }
    })();
}

// Default export is still useful for testing purposes
export default createApp;