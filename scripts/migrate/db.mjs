import mysql from 'mysql2/promise';

export async function connect() {
  return mysql.createConnection({
    host: 'localhost',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'michelle',
  });
}

export async function query(conn, sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}
