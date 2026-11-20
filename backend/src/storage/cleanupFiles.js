import pool from "../db/pool.js";
import { storage } from "./s3.js";

// how long an upload can stay unattached before it's treated as abandoned
// uploads happen seconds before a lesson saves, so a day leaves a wide margin
const ABANDONED_AFTER = "1 day";

// removes files that were uploaded but never saved into a lesson (failed save, closed tab)
// rows are deleted first, then their s3 objects, so a lesson can never point at a deleted file
export async function deleteAbandonedFiles(db = pool){
    const result = await db.query(
        `DELETE FROM lessonFiles
        WHERE lessonID IS NULL AND createdAt < now() - $1::interval
        RETURNING s3Key`,
        [ABANDONED_AFTER]
    );

    for (const row of result.rows){
        try{
            await storage.deleteFile(row.s3key);
        } catch (err) {
            console.error(`Could not delete ${row.s3key} from S3:`, err);
        }
    }

    return result.rows.length;
}