import {Cluster} from "puppeteer-cluster";
import {addExtra} from "puppeteer-extra";
import Stealth from "puppeteer-extra-plugin-stealth";
import AnonymizeUa from "puppeteer-extra-plugin-anonymize-ua";
import vanillaPuppeteer from 'puppeteer';
import {delay, sendToTelegram} from "./service.js";
import axios from "axios";
import request from "request"

export default class Parser {
    db = null;
    puppeteer = null;
    url = null;
    kaptchaKey = null

    constructor(db) {
        this.db = db;
    }

    config() {
        this.url = process.env.URL;

        this.puppeteer = addExtra(vanillaPuppeteer);

        this.puppeteer.use(Stealth());

        this.puppeteer.use(AnonymizeUa());
    }

    async launchBrowser() {
        this.config();

        let options = {
            ignoreDefaultArgs: [
                "--disable-extensions",
                "--enable-automation"
            ],
            args: [
                '--autoplay-policy=user-gesture-required',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-client-side-phishing-detection',
                '--disable-component-update',
                '--disable-default-apps',
                '--disable-dev-shm-usage',
                '--disable-domain-reliability',
                '--disable-features=AudioServiceOutOfProcess',
                '--disable-hang-monitor',
                '--disable-ipc-flooding-protection',
                '--disable-notifications',
                '--disable-offer-store-unmasked-wallet-cards',
                '--disable-popup-blocking',
                '--disable-print-preview',
                '--disable-prompt-on-repost',
                '--disable-renderer-backgrounding',
                '--disable-setuid-sandbox',
                '--disable-speech-api',
                '--disable-sync',
                '--hide-scrollbars',
                '--ignore-gpu-blacklist',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-first-run',
                '--no-pings',
                '--no-sandbox',
                '--no-zygote',
                '--password-store=basic',
                '--use-gl=swiftshader',
                '--use-mock-keychain',
                '--lang=en-US,en;q=0.9',
                '--ignore-certificate-errors'
            ]
        }

        const cluster = await Cluster.launch({
            puppeteer: this.puppeteer,
            puppeteerOptions: options,
            maxConcurrency: 5,
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            monitor: true,
            timeout: 20000000
        });

        let participants = await this.db.getParticipants();

        participants.forEach((item) => {
            cluster.queue(this.url, async ({page, data: url}) => {
                let isCaptchaSolved = false;
                let isClosed = false;

                await page.goto(url);

                await page.setViewport({
                    width: 1200,
                    height: 1483
                });

                console.log('Wait For Selector ------ ', `${item.name} ${item.confirm} ${item.year}`);

                await page.waitForSelector('.container', {
                    timeout: 60000
                });

                console.log('Waited For Selector ------ ', `${item.name} ${item.confirm} ${item.year}`);

                await page.evaluate(async () => {
                    // Scroll down to bottom of page to activate lazy loading images
                    document.body.scrollIntoView(false);

                    // Wait for all remaining lazy loading images to load
                    await Promise.all(Array.from(document.getElementsByTagName('img'), image => {
                        if (image.complete) {
                            return;
                        }

                        return new Promise((resolve, reject) => {
                            image.addEventListener('load', resolve);
                            image.addEventListener('error', reject);
                        });
                    }));
                });

                console.log('---- all images loaded ----')

                const rect = await page.evaluate(selector => {
                    const element = document.querySelector(selector);
                    const {x, y, width, height} = element.getBoundingClientRect();
                    return {left: x, top: y, width, height, id: element.id};
                }, '.LBD_CaptchaDiv');


                await page.screenshot({
                    path: `./screenshots/captcha_${item.name}_${item.confirm}_${item.year}.png`,
                    clip: {
                        x: rect.left - 10,
                        y: rect.top - 10,
                        width: rect.width + 10 * 2,
                        height: rect.height + 10 * 2
                    }
                });

                let captchaImage = await page.screenshot({
                    encoding: "base64",
                    clip: {
                        x: rect.left - 10,
                        y: rect.top - 10,
                        width: rect.width + 10 * 2,
                        height: rect.height + 10 * 2
                    }
                });

                await request.post({
                    url: 'http://2captcha.com/in.php',
                    formData: {
                        key: process.env.TWO_CAPTCHA_API_KEY,
                        method: 'base64',
                        body: captchaImage
                    }
                }, async (error, response, body) => {
                    if (error) {
                        console.error(error);
                    } else {
                        const captchaId = body.split('|')[1];

                        while (!isCaptchaSolved) {
                            let {
                                data
                            } = await axios.get(`http://2captcha.com/res.php?key=e551a4c82840bf2bbe664c23b4fe93de&action=get&id=${captchaId}`);

                            if (data == 'ERROR_CAPTCHA_UNSOLVABLE') {
                                isCaptchaSolved = true;
                                console.log(data, this.kaptchaKey, `${item.name} ${item.confirm} ${item.year}`, '---------------');
                                sendToTelegram(`Captcha unsolved FOR: ${item.name} ${item.confirm} ${item.year}`);
                                continue;
                            }

                            if (data != 'CAPCHA_NOT_READY' && data != 'ERROR_CAPTCHA_UNSOLVABLE') {
                                this.kaptchaKey = data.split('|')[1]
                                isCaptchaSolved = true;

                                console.log(data, this.kaptchaKey, `${item.name} ${item.confirm} ${item.year}`, '+++++++++++++');

                                await page.type('#txtCN', item.confirm);
                                await page.type('#txtLastName', item.name);
                                await page.type('#txtYOB', item.year);
                                await page.type('#txtCodeInput', this.kaptchaKey);

                                await Promise.all([
                                    await page.click('#btnCSubmit'),
                                    page.waitForNavigation({waitUntil: 'networkidle2', timeout: 800000})
                                ]);

                                const isNotWin = await page.evaluate(() => window.find("HAS NOT BEEN SELECTED"));
                                const isFieldValidationError = await page.evaluate(() => window.find("is not valid"));
                                const isCaptchaValidationError = await page.evaluate(() => window.find("Please enter"));

                                const hasValidationError = isFieldValidationError || isCaptchaValidationError

                                if(hasValidationError) {
                                    await page.screenshot({
                                        path: `./screenshots/VALIDATION_${item.name}_${item.confirm}_${item.year}.png`,
                                        fullPage: true
                                    });

                                    console.log('Validation error -----', `${item.name} ${item.confirm} ${item.year}`, {isFieldValidationError, isCaptchaValidationError});
                                }

                                if (!isNotWin && !hasValidationError) {
                                    console.log('Winner ------', `${item.name} ${item.confirm} ${item.year}`, {
                                        isFieldValidationError,
                                        isCaptchaValidationError
                                    }, {isNotWin})

                                    await page.screenshot({
                                        path: `./screenshots/${item.name}_${item.confirm}_${item.year}.png`,
                                        fullPage: true
                                    });

                                    await this.db.setWinner(item.id);

                                    sendToTelegram(`${item.name} ${item.confirm} ${item.year}`)
                                }

                                if (!hasValidationError) {
                                    await this.db.setChecked(item.id);

                                    await page.screenshot({
                                        path: `./screenshots/END_RESULT_${item.name}_${item.confirm}_${item.year}.png`,
                                        fullPage: true
                                    });
                                }

                                isClosed = true;
                            } else {
                                console.log(data);
                                await delay(3000);
                            }
                        }
                    }
                })

                while (!isClosed) {
                    await delay(1000);
                    // console.log('wait for close');
                }
            });
        })

        cluster.on('taskerror', (err, data, willRetry) => {
            if (willRetry) {
                console.warn(`Encountered an error while crawling ${data}. ${err.message}\nThis job will be retried`);
            } else {
                console.error(`Failed to crawl ${data}: ${err.message}`);
            }
        });

        await cluster.idle();
        await cluster.close();
        await this.db.closeConnection()
    }
}
