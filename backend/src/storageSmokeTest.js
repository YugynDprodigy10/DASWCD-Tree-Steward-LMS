// simple test file to ensure that the storage helper s3.js is behaving as expected

import "dotenv/config";
import {storage} from "./storage/s3.js";

const key = "materials/smoke-test.txt";
const fileName = "smoke-test.txt";
const formKey = "materials/smoke-form.txt";

await storage.putFile(key, Buffer.from("hello"), "text/plain");
const url = await storage.signedUrl(key, fileName);

//console.log(url);
await storage.deleteFile(key);

const result = await storage.uploadForm(formKey, "text/plain");
console.log(Object.keys(result.fields));

const form = new FormData();
for (const [name, value] of Object.entries(result.fields)) {
  form.append(name, value);
}
form.append("file", new Blob(["hello form"]), "smoke-form.txt");
const response = await fetch(result.url, { method:"POST", body:form });
console.log(response.status);
if (response.status !== 204){
    console.log(await response.text());
};
await storage.deleteFile(formKey);