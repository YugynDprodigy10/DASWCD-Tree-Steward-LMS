CREATE TABLE IF NOT EXISTS studentPageViews (
    pageViewID BIGSERIAL PRIMARY KEY,
    visitID UUID NOT NULL,
    userID INT NOT NULL REFERENCES users(userID) ON DELETE CASCADE,
    moduleID INT NOT NULL REFERENCES modules(moduleID) ON DELETE CASCADE,
    pageKey TEXT NOT NULL,
    pageTitle TEXT NOT NULL,
    durationSeconds INT NOT NULL DEFAULT 0 CHECK (durationSeconds >= 0),
    createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (userID, visitID)
);

CREATE INDEX IF NOT EXISTS student_page_views_by_module
    ON studentPageViews (moduleID, pageKey);
