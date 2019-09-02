import express from "express"
import router from "./index"
const { NODE_ENV, PORT = 3000 } = process.env;


var app = express()

app.use("/", router)

if (NODE_ENV !== "test")
    app.listen(PORT, () =>
        console.log(`School project running on port ${PORT}! on ${NODE_ENV} mode.`)
    );

export default app;
