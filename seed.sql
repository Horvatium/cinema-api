-- KinoPlex demo data. Load after schema.sql:
--   mysql -u root -p cinema < schema.sql
--   mysql -u root -p cinema < seed.sql
--
-- Test accounts (for local development only):
--   admin@kinoplex.test / Admin123!  (admin)
--   demo@kinoplex.test  / Demo123!   (customer)
--
-- Screenings are generated relative to the current date, so the programme
-- always shows upcoming showtimes regardless of when the seed is run.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE reservation_seats;
TRUNCATE TABLE reservations;
TRUNCATE TABLE screenings;
TRUNCATE TABLE seats;
TRUNCATE TABLE rooms;
TRUNCATE TABLE films;
TRUNCATE TABLE users;
TRUNCATE TABLE email_log;
SET FOREIGN_KEY_CHECKS = 1;

-- Users (passwords hashed with bcrypt, cost 10)
INSERT INTO users (id, first_name, last_name, email, password, phone, role, email_verified) VALUES
(1, 'Admin', 'KinoPlex', 'admin@kinoplex.test',
    '$2b$10$6fubTVaqV.rm8ZBEUEHXR.wydkgTif21fScKFQOmSMbt1k8un45S2', NULL, 'admin', 1),
(2, 'Demo', 'Uporabnik', 'demo@kinoplex.test',
    '$2b$10$K3NjBDc4nnjwR9opEgdp3OfnOU0zpiEzmKnTVFrNbF4vfXPmiKlW2', '040123456', 'customer', 1);

-- Rooms
INSERT INTO rooms (id, name, capacity) VALUES
(1, 'Dvorana 1', 60),
(2, 'Dvorana 2', 40);

-- Seats: room 1 = rows A-F x 10 seats, room 2 = rows A-E x 8 seats
-- (same layout the API creates when an admin adds a room)
INSERT INTO seats (room_id, row_label, seat_number)
WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 10)
SELECT r.room_id, SUBSTRING('ABCDEF', rw.i, 1), s.i
FROM (SELECT 1 AS room_id, 6 AS row_count, 10 AS per_row
      UNION ALL SELECT 2, 5, 8) r
JOIN n rw ON rw.i <= r.row_count
JOIN n s ON s.i <= r.per_row
ORDER BY r.room_id, rw.i, s.i;

-- Films (posters left empty; the web app shows a placeholder)
INSERT INTO films (id, title, title_sl, genre, duration_minutes, age_rating, synopsis, director,
                   release_year, imdb_url, cast_members) VALUES
(1, 'Inception', 'Izvor', 'Znanstvena fantastika', 148, '12+',
    'Tat, ki krade skrivnosti iz sanj, dobi nalogo, da v podzavest vsadi idejo.',
    'Christopher Nolan', 2010, 'https://www.imdb.com/title/tt1375666/',
    'Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page'),
(2, 'Spirited Away', 'Čudežno potovanje', 'Animirani', 125, '0-12',
    'Deklica se znajde v svetu duhov in mora rešiti starša.',
    'Hayao Miyazaki', 2001, 'https://www.imdb.com/title/tt0245429/',
    'Rumi Hiiragi, Miyu Irino'),
(3, 'The Grand Budapest Hotel', 'Hotel Grand Budapest', 'Komedija', 99, '12+',
    'Legendarni receptor in njegov vajenec se zapleteta v krajo dragocene slike.',
    'Wes Anderson', 2014, 'https://www.imdb.com/title/tt2278388/',
    'Ralph Fiennes, Tony Revolori, Saoirse Ronan'),
(4, 'Mad Max: Fury Road', 'Pobesneli Max: Cesta besa', 'Akcija', 120, '15+',
    'V postapokaliptični puščavi se Max pridruži uporniški vojščakinji na begu pred tiranom.',
    'George Miller', 2015, 'https://www.imdb.com/title/tt1392190/',
    'Tom Hardy, Charlize Theron'),
(5, 'Coco', 'Coco', 'Animirani', 105, '0-12',
    'Mladi glasbenik se znajde v deželi mrtvih in išče svojega pradedka.',
    'Lee Unkrich', 2017, 'https://www.imdb.com/title/tt2380307/',
    'Anthony Gonzalez, Gael García Bernal'),
(6, 'Arrival', 'Prihod', 'Znanstvena fantastika', 116, '12+',
    'Jezikoslovka poskuša vzpostaviti stik z nezemljani, ki so pristali na Zemlji.',
    'Denis Villeneuve', 2016, 'https://www.imdb.com/title/tt2543164/',
    'Amy Adams, Jeremy Renner');

-- Screenings for the next 7 days: two showtimes per room per day,
-- films rotate so each film appears several times
INSERT INTO screenings (film_id, room_id, start_time, end_time, price, active)
WITH RECURSIVE d AS (SELECT 0 AS day UNION ALL SELECT day + 1 FROM d WHERE day < 6),
slots AS (
    SELECT 1 AS room_id, '17:30:00' AS t, 0 AS k UNION ALL
    SELECT 1, '20:30:00', 1 UNION ALL
    SELECT 2, '18:00:00', 2 UNION ALL
    SELECT 2, '21:00:00', 3
)
SELECT f.id, sl.room_id, x.start_time,
       x.start_time + INTERVAL f.duration_minutes MINUTE,
       IF(sl.t >= '20:00:00', 8.50, 7.00), 1
FROM d
JOIN slots sl
JOIN films f ON f.id = (d.day * 4 + sl.k) % 6 + 1
JOIN LATERAL (
    SELECT TIMESTAMP(CURDATE() + INTERVAL (d.day + 1) DAY, sl.t) AS start_time
) x
ORDER BY x.start_time, sl.room_id;

-- One confirmed reservation for the demo user (seats D5, D6 of the first screening)
INSERT INTO reservations (id, user_id, screening_id, status, total_price)
SELECT 1, 2, s.id, 'confirmed', 2 * s.price FROM screenings s ORDER BY s.id LIMIT 1;

INSERT INTO reservation_seats (reservation_id, seat_id)
SELECT 1, se.id
FROM reservations r
JOIN screenings sc ON sc.id = r.screening_id
JOIN seats se ON se.room_id = sc.room_id AND se.row_label = 'D' AND se.seat_number IN (5, 6)
WHERE r.id = 1;
