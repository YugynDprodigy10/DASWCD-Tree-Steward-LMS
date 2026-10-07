DELETE FROM users
WHERE LOWER(username) = 'test user 1';

INSERT INTO users (username, passwordTemp, student, teacher, administrator)
SELECT 'test admin 1', 'Test Password 1', FALSE, FALSE, TRUE
WHERE NOT EXISTS (
	SELECT 1 FROM users WHERE LOWER(username) = 'test admin 1'
);

SELECT *
FROM users;

