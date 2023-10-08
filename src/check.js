import * as dotenv from "dotenv";
import Parser from "./Parser.js";
import DB from "./db.js";

dotenv.config({path: '../.env'});

let db = await DB.getInstance();

await ((new Parser(db)).launchBrowser());

