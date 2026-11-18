CREATE TABLE IF NOT EXISTS moduleLessons(
    lessonID SERIAL PRIMARY KEY,
    moduleID INT NOT NULL REFERENCES modules(moduleID),
    title TEXT NOT NULL CHECK(char_length(title) BETWEEN 1 AND 150),
    content JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(content) = 'array'),
    published BOOLEAN NOT NULL DEFAULT FALSE,
    createdBy INT NOT NULL REFERENCES users(userID),
    createdAt TIMESTAMPTZ NOT NULL DEFAULT now(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lessonFiles(
    fileID SERIAL PRIMARY KEY,
    moduleID INT NOT NULL REFERENCES modules(moduleID),
    lessonID INT REFERENCES moduleLessons(lessonID),
    s3Key TEXT NOT NULL UNIQUE,
    fileName TEXT NOT NULL,
    contentType TEXT NOT NULL CHECK(contentType IN ('application/pdf', 'video/mp4', 'video/webm')),
    sizeBytes BIGINT NOT NULL CHECK(sizeBytes > 0 AND sizeBytes <= 104857600),
    uploadedBy INT NOT NULL REFERENCES users(userID),
    uploaded BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moduleLessons_moduleID_idx ON moduleLessons (moduleID);
CREATE INDEX IF NOT EXISTS lessonFiles_lessonID_idx ON lessonFiles (lessonID);