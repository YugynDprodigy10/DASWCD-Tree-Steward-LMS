CREATE TABLE IF NOT EXISTS moduleMaterials(
    materialID SERIAL PRIMARY KEY,
    moduleID INT NOT NULL REFERENCES modules(moduleID),
    title TEXT NOT NULL,
    description TEXT,
    transcript TEXT,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    s3Key TEXT NOT NULL UNIQUE,
    fileName TEXT NOT NULL,
    contentType TEXT NOT NULL CHECK(contentType IN ('application/pdf', 'video/mp4', 'video/webm')),
    sizeBytes BIGINT NOT NULL CHECK(sizeBytes > 0 AND sizeBytes <= 104857600),
    uploadedBy INT NOT NULL REFERENCES users(userID),
    createdAt TIMESTAMPTZ NOT NULL DEFAULT now(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moduleMaterials_moduleID_idx ON moduleMaterials (moduleID);