import { deleteAbandonedFiles } from "../../src/storage/cleanupFiles.js";

// netlify runs this once a day on the published site
// it removes lesson files that were uploaded but never saved into a lesson
export default async () => {
    const removed = await deleteAbandonedFiles();
    console.log(`Removed ${removed} abandoned lesson file(s).`);
};

export const config = { schedule: "@daily" };