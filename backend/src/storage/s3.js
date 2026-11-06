import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// No config needed: the SDK reads AWS_REGION, AWS_ACCESS_KEY_ID and
// AWS_SECRET_ACCESS_KEY from process.env (loaded by dotenv in server.js).
const client = new S3Client({});

// returns bucket name or throws error if S3_BUCKET is missing
function bucket() {
    const s3_bucket = process.env.S3_BUCKET?.trim();
    if (!s3_bucket) {
        throw new Error("S3_BUCKET not set. Add to backend/.env");
    }
    return s3_bucket;
}

export const storage = {
  async putFile(key, body, contentType) {
    await client.send(new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,          // a Buffer (multer memory storage gives you req.file.buffer)
      ContentType: contentType,
    }));
  },

  async deleteFile(key) {
    // deletes object at key
    await client.send(new DeleteObjectCommand({
        Bucket: bucket(),
        Key: key,
    }));
  },

  async signedUrl(key, fileName) {
    // returns a temp link (15 mins) that lets browser open private file
    // signing is local with no aws call. links regenerated each time materials are listed
    const command = new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
        ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
    return getSignedUrl(client, command, {expiresIn: 900});
  },
};