DELETE FROM users
WHERE LOWER(username) = 'test user 1';

INSERT INTO users (username, email, passwordTemp, student, teacher, administrator)
SELECT 'test admin 1', 'testadmin1@example.com', 'Test Password 1', FALSE, FALSE, TRUE
WHERE NOT EXISTS (
	SELECT 1 FROM users WHERE LOWER(username) = 'test admin 1'
);

INSERT INTO users (username, email, passwordTemp, student, teacher, administrator)
SELECT 'test student 1', 'teststudent1@example.com', 'Test Password 1', TRUE, FALSE, FALSE
WHERE NOT EXISTS (
	SELECT 1 FROM users WHERE LOWER(username) = 'test student 1'
);

INSERT INTO users (username, email, passwordTemp, student, teacher, administrator)
SELECT 'test teacher 1', 'testteacher1@example.com', 'Test Password 1', FALSE, TRUE, FALSE
WHERE NOT EXISTS (
	SELECT 1 FROM users WHERE LOWER(username) = 'test teacher 1'
);

-- The 12 weekly modules, matching the IDs the frontend uses.
INSERT INTO modules (moduleID, name) VALUES
	(1, 'Welcome to tree stewardship'),
	(2, 'Tree identification'),
	(3, 'Getting to know your soil'),
	(4, 'Choosing the right tree'),
	(5, 'Planting with purpose'),
	(6, 'Water-wise care'),
	(7, 'Capturing rainwater'),
	(8, 'Mulch and healthy roots'),
	(9, 'Pruning fundamentals'),
	(10, 'Recognizing tree stress'),
	(11, 'Trees and community'),
	(12, 'Your stewardship journey')
ON CONFLICT (moduleID) DO NOTHING;
SELECT setval(pg_get_serial_sequence('modules', 'moduleid'), (SELECT MAX(moduleID) FROM modules));

-- The test teacher teaches Week 2, like the instructor demo.
INSERT INTO moduleTeachers (moduleID, userID)
SELECT 2, userID FROM users WHERE LOWER(username) = 'test teacher 1'
ON CONFLICT DO NOTHING;

-- The test student is enrolled in every module.
INSERT INTO moduleStudents (moduleID, userID, status)
SELECT m.moduleID, u.userID, 'active'
FROM modules m CROSS JOIN users u
WHERE LOWER(u.username) = 'test student 1'
ON CONFLICT DO NOTHING;

SELECT userID, username, email, student, teacher, administrator
FROM users;