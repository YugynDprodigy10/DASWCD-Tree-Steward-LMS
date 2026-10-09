DELETE FROM users
WHERE LOWER(username) = 'test user 1';

INSERT INTO users (username, email, passwordTemp, student, teacher, administrator)
SELECT 'test admin 1', 'testadmin1@example.com', 'Test Password 1', FALSE, FALSE, TRUE
WHERE NOT EXISTS (
	SELECT 1 FROM users WHERE LOWER(username) = 'test admin 1'
);

SELECT *
FROM users;

