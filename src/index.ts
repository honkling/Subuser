import e, { Application, json, Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { join } from 'path';
import { checkBody, getMain, hashPassword } from './util/Util';
import { Database, RunResult } from 'sqlite3';
import { compare } from 'bcrypt';
import { Permission } from './types/Permission';
import { is } from 'typescript-is';
import { v4 } from 'uuid';

const app: Application = e();
let db: Database;
(async () => { db = await getMain(); db.run(`CREATE TABLE IF NOT EXISTS info (
	uuid TEXT NOT NULL,
	authorization TEXT NOT NULL,
	slgSession TEXT NOT NULL,
	slgUser TEXT NOT NULL,
	key TEXT NOT NULL,
	keySalt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subusers (
	serverId TEXT NOT NULL,
	subusers TEXT NOT NULL
);`) })();
const { port } = require(join(__dirname, '../config.json'));

app.use(rateLimit({
	windowMs: 1 * 60 * 1000,
	max: 3,
	message: { status: 429, message: 'Rate limit exceeded. Please wait a minute.' },
}));
app.use(json());
app.use(cors())

app.get('/', (req: Request, res: Response) => {
	res.sendStatus(200);
});

app.post('/user/create_key', async (req: Request, res: Response) => {
	const Body = {
		token: "",
		slgSession: "",
		slgUser: "",
		key: "",
	}
	if(!checkBody(Body, req.body, res)) return;
	db.all('SELECT * FROM info WHERE uuid = $uuid', {
        $uuid: req.body.uuid,
    }, async (err: Error, rows: any[]) => {
        if(err) {
			res.status(500).json({"error":"An error occurred fetching existing rows."});
			return console.error(err);
		}
        if(rows.length > 0) return res.status(400).json({"error":"There already exists an account with that uuid."});
		const keyInfo = await hashPassword(req.body.key);
		const uuid = v4();
		db.run('INSERT INTO info(uuid, authorization, slgSession, slgUser, key, keySalt) VALUES(?, ?, ?, ?, ?, ?)', [
			uuid,
			req.body.token,
			req.body.slgSession,
			req.body.slgUser,
			keyInfo.password,
			keyInfo.salt,
		], (_: RunResult, err: Error) => {
			if(err) {
				res.status(500).json({"error":"An error occurred creating your key."});
				return console.error(err);
			}
			res.status(200).json({ uuid });
		});
    });
});

app.post('/server/:id/create_subuser', (req: Request, res: Response) => {
	const Body = {
		"uuid": "",
		"subuserUUID": "",
		"permissions": [],
		"key": "",
	}
	if(!checkBody(Body, req.body, res)) return;
	db.all('SELECT * FROM info WHERE uuid = $uuid', {
		$uuid: req.body.uuid,
	}, async (err: Error, rows: any[]) => {
		if(err) {
			res.status(500).json({"error":"An error occurred fetching existing rows."});
			return console.error(err);
		}
		if(rows.length === 0) return res.status(400).json({"error":"No account linked with that uuid exists."});
		if(await compare(req.body.key, rows[0].key)) {
			db.all('SELECT * FROM subusers WHERE serverId = ?', [req.query.id], (err: Error, rows: any[]) => {
				if(err) {
					res.status(500).json({"error":"An error occurred fetching server subusers info."});
					return console.error(err);
				}
				const list: { [name: string]: Permission[] } = JSON.parse(rows.length >= 1 ? rows[0].subusers : '{}');
				if(list[req.body.uuid]) return res.status(400).json({"error":"That subuser is already present on this server."});
				const invalidPermissions = [];
				for(const permission of req.body.permissions) {
					if(!is<Permission>(permission)) {
						invalidPermissions.push(permission);
					}
				}
				if(invalidPermissions.length > 0) return res.status(400).json({"error":`Invalid permissions were provided: '${invalidPermissions.join('\', \'')}.'`});
				list[req.body.uuid] = req.body.permissions;
				db.run('UPDATE subusers SET subusers = ? WHERE serverId = ?', [JSON.stringify(list), req.query.id], (err: Error) => {
					if(err) {
						res.status(500).json({"error":"An error occurred saving subusers info."});
						return console.error(err);
					}
					res.status(204).send({});
				});
			});
		}
	});
});

app.post('/server/:id/remove_subuser', (req: Request, res: Response) => {
	const Body = {
		"uuid": "",
		"email": "",
		"key": "",
	}
	if(!checkBody(Body, req.body, res)) return;
	db.all('SELECT * FROM info WHERE uuid = $uuid', {
		$uuid: req.body.uuid,
	}, async (err: Error, rows: any[]) => {
		if(err) {
			res.status(500).json({"error":"An error occurred fetching existing rows."});
			return console.error(err);
		}
		if(rows.length === 0) return res.status(400).json({"error":"No account linked with that uuid exists."});
		if(await compare(req.body.key, rows[0].key)) {
			db.all('SELECT * FROM subusers WHERE serverId = ?', [req.query.id], (err: Error, rows: any[]) => {
				if(err) {
					res.status(500).json({"error":"An error occurred fetching server subusers info."});
					return console.error(err);
				}
				const list: { [name: string]: Permission[] } = JSON.parse(rows[0].subusers);
				delete list[req.body.uuid];
				db.run('UPDATE subusers SET subusers = ? WHERE serverId = ?', [JSON.stringify(list), req.query.id], (err: Error) => {
					if(err) {
						res.status(500).json({"error":"An error occurred saving subusers info."});
						return console.error(err);
					}
					res.status(204).send({});
				});
			});
		}
	});
});

app.listen(port, () => { console.log('Ready.') });