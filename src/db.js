import mysql from "mysql2/promise";

let instance = null;
let db = null;

export default class DB {
    static async getInstance() {
        if (!instance) {
            let connection = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE
            })

            console.log('connecting to db...');

            await connection.connect();

            db = connection;
            instance = new DB();

            return instance;
        }

        return instance;
    }

    async getParticipants() {
        let [proxies] = await db.query('SELECT * FROM participants WHERE status=1');

        return proxies;
    }

    async setWinner(id) {
        await db.execute('UPDATE participants SET is_win=1 WHERE participants.id = ?', [id]);
    }

    async setChecked(id) {
        await db.execute('UPDATE participants SET status=2 WHERE participants.id = ?', [id]);
    }

    async importParticipants(items) {
        await db.query(
            'INSERT INTO participants (name, confirm, year) VALUES ?',
            [items.filter(item => item.name).map(item => [item.name, item.confirm, item.year])]
        );
    }

    async clearParticipants() {
        await db.query('TRUNCATE participants',);
    }

    async closeConnection() {
        console.log('closing db connection...')

        await db.end();
    }
};

