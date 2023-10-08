import * as dotenv from "dotenv";
import DB from "./db.js";
import {readCSV} from "./service.js";

dotenv.config({path: '../.env'});

const db = await DB.getInstance();

let items = (await readCSV('./data/data.csv')).map(item => ({name: item[1], confirm: item[2], year: item[0]}));

if (items.length) {
    await db.clearParticipants();

    await db.importParticipants(items);
}

await db.closeConnection();
