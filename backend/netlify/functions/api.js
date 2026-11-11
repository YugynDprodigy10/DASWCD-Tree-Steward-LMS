import serverless from "serverless-http";
import app from "../../src/app.js";

// Keep the existing Express application and routes as the single API source.
export const handler = serverless(app);
