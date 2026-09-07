const mysql = require('mysql2');
require('dotenv').config();

// Bazen povezav namesto ene same povezave: zahtevki se ne blokirajo med
// seboj, transakcije pa lahko iz bazena vzamejo svojo namensko povezavo
// (db.getConnection()).
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    // Gostovana baza zahteva SSL, a s samopodpisanim potrdilom, zato
    // preverjanja verige potrdil ne izvajamo
     ssl: {
        rejectUnauthorized: false
    }
});

// Različica z obljubami, da lahko povsod pišemo await db.query(...)
// namesto gnezdenih povratnih klicev
module.exports = pool.promise();