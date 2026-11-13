import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// due to netlify reserving AWS_* variables for its functions, this module uses S3_* names and passes
// creditials to the sdk explicitly 
let client;

// creates s3 client on first use. missing s3 setting only breaks file
// features instead of crashing the entire api at start
function getClient(){
  if (!client){
    client = new S3Client({
      region: requiredEnv("S3_REGION"),
      credentials: {
        accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

// reads required setting from env or throws a clear setup error naming it
function requiredEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} not set. Add to backend/.env`);
    }
    return value;
}

export const storage = {
  async putFile(key, body, contentType) {
    await getClient().send(new PutObjectCommand({
      Bucket: requiredEnv("S3_BUCKET"),
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  },

  async deleteFile(key) {
    // deletes object at key
    await getClient().send(new DeleteObjectCommand({
        Bucket: requiredEnv("S3_BUCKET"),
        Key: key,
    }));
  },

  async signedUrl(key, fileName) {
    // returns a temp link (15 mins) that lets browser open private file
    // signing is local with no aws call. links regenerated each time materials are listed
    const command = new GetObjectCommand({
        Bucket: requiredEnv("S3_BUCKET"),
        Key: key,
        ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
    return getSignedUrl(getClient(), command, {expiresIn: 900});
  },
};