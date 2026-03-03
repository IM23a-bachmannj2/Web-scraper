import type { Request, Response } from 'express';

// ---------------------------------------------------
// API

const express = require('express')
const app = express()
const port = 3000

app.use(express.static(__dirname + "/../public"));

app.get("/", (req: Request, res: Response) => {
    res.sendFile(process.cwd() + "/public/index.html");
});



app.listen(port, () => {
    console.log(`listening on port ${port}`)
})

// ---------------------------------------------------
// Scraper Codes