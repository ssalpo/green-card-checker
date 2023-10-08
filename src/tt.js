import {sendToTelegram} from "./service.js";
import * as dotenv from "dotenv";

dotenv.config({path: '../.env'});

sendToTelegram('TTTT');
