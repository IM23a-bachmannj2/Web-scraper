"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// ---------------------------------------------------
// API
const express = require('express');
const app = express();
const port = 3000;
app.use(express.static(__dirname + "/../public"));
app.get("/", (req, res) => {
    res.sendFile(process.cwd() + "/public/index.html");
});
app.listen(port, () => {
    console.log(`listening on port ${port}`);
});
// ---------------------------------------------------
// Scraper Codes
//# sourceMappingURL=backend.js.map