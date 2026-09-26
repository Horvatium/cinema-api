const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const connect = (withDatabase = true) =>
    mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: withDatabase ? process.env.DB_NAME : undefined,
        multipleStatements: true,
    });

// Izbriše testno bazo in jo ustvari na novo iz schema.sql
const createDatabase = async () => {
    const conn = await connect(false);
    const name = process.env.DB_NAME;
    await conn.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await conn.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
    await conn.query(`USE \`${name}\``);
    await conn.query(read('schema.sql'));
    await conn.end();
};

// Obnovi demo podatke iz seed.sql (ta najprej izprazni vse tabele)
const resetData = async () => {
    const conn = await connect();
    await conn.query(read('seed.sql'));
    await conn.end();
};

module.exports = { createDatabase, resetData };
