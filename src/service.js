import axios from 'axios';
import fs from 'fs';
import Papa from "papaparse";
export async function sendToTelegram(text) {
    let url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`

    let {data} = await axios.post(url, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: text
    })
}

export async function readCSV(filePath) {
    const csvFile = fs.readFileSync(filePath)
    const csvData = csvFile.toString()
    return new Promise(resolve => {
        Papa.parse(csvData, {
            header: true,
            complete: results => {
                resolve(results.data.map(i => Object.values(i)));
            }
        });
    });
}

export async function loadData(fileName) {
    return JSON.parse(await fs.readFile(fileName, "utf8"));
}

export function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}
