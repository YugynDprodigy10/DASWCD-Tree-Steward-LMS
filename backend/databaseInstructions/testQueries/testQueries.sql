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

SELECT userID, username, email, student, teacher, administrator
FROM users;
