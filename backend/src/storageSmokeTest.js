import "dotenv/config";
import {storage} from "./storage/s3.js";

const key = "materials/smoke-test.txt";
const fileName = "smoke-test.txt";

await storage.putFile(key, Buffer.from("hello"), "text/plain");
const url = await storage.signedUrl(key, fileName);

console.log(url);
//await storage.deleteFile(key);