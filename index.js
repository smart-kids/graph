// this is specifically here so cloud functions cam pick it up.
// development and testing shoould be happening inside th esrc folder
const { default: app } = require("./dist")

module.exports.default = app;