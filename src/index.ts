import e, { Application, json, Request, Response, urlencoded } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { checkBody, getMain, hashPassword } from './util/Util';
import { Database, RunResult } from 'sqlite-async';
import { compare } from 'bcrypt';
import { Permission } from './types/Permission';
import * as unirest from 'unirest';
import { v4 } from 'uuid';
import proxy from 'express-http-proxy';

const app: Application = e();
let db: Database;
(async () => { db = await getMain(); db.run(`CREATE TABLE IF NOT EXISTS info (
	uuid TEXT NOT NULL PRIMARY KEY,
	authorization TEXT NOT NULL,
	slgSession TEXT NOT NULL,
	slgUser TEXT NOT NULL,
	key TEXT NOT NULL,
	keySalt TEXT NOT NULL
);`); db.run(`CREATE TABLE IF NOT EXISTS subusers (
	serverId TEXT NOT NULL PRIMARY KEY,
	subusers TEXT NOT NULL,
);`) })();
import { port } from './../config.json';

app.use(rateLimit({
	windowMs: 1 * 60 * 1000,
	max: 60,
	message: { status: 429, message: 'Rate limit exceeded. Please wait a minute.' },
}));
app.use(cors());

app.all('/proxy/*', async (req, res) => {
	const serverId = req.path.match(/[0-9a-f]{24}/);
	if(!serverId)
		return res.status(400).json({
			error: 'Failed to find a server ID.',
		});
	
	const Body = {
		key: "",
	};
	if(!checkBody(Body, req.body, res)) return;

	// Fetch subusers information
	try {
		const serverInformation = await db.all('SELECT subusers FROM subusers WHERE serverId = ?', [
			serverId,
		]);
		
		if(serverInformation.length === 0)
			return res.status(400).json({
				error: 'Not authorized.',
			});
		
		
	} catch (e) {
		console.error(e);
		return res.status(500).json({
			error: 'An error occurred fetching subusers information.',
		});
	}

	// TODO: Finish proxying

	proxy('https://api.minehut.com', {
		proxyReqPathResolver: (req) => {
			return req.path.substring(6);
		},
	});
});

app.use(urlencoded({
	extended: true,
}));
app.use(json());

app.get('/', (req: Request, res: Response) => {
	res.sendStatus(200);
});

app.post('/user/generate_key', async (req: Request, res: Response) => {generateKey:{
	const Body = {
		token: '',
		slgSession: '',
		slgUser: '',
	}
	if(!checkBody(Body, req.body, res)) return;

	const {
		token,
		slgSession,
		slgUser,
	} = req.body;

	try {
		var userResponse = await unirest.post('https://authentication-service-prod.superleague.com/v1/user/login/ghost')
			.headers({
				'X-SLG-SESSION': slgSession,
				'X-SLG-USER': slgUser,
			})
			.send({
				slgSessionId: slgSession,
			});
	} catch (e) {
		console.error(e);
		return res.status(500).json({
			error: 'An error occurred validating provided credentials.',
		});
	}
	
	if(userResponse.status !== 200)
		return res.status(400).json({
			error: 'Invalid credentials provided.',
		});
	
	const uuid: string = userResponse.body.minehutSessionData._id;
	const key: string = v4();
	const hashedKey = await hashPassword(key);

	try {
		db.run('INSERT OR REPLACE INTO info(uuid, authorization, slgSession, slgUser, key, keySalt) VALUES (?, ?, ?, ?, ?, ?)', [
			uuid,
			token,
			slgSession,
			slgUser,
			hashedKey.password,
			hashedKey.salt,
		]);
	} catch (e) {
		console.error(e);
		return res.status(500).json({
			error: 'An error occurred generating your key.',
		});
	}
	
	res.status(200).json({
		uuid,
		key,
	});
}});

app.post('/server/:id/generate_subuser_key', async (req: Request, res: Response) => {
	const Body = {
		server: '',
		uuid: '',
	};
	if(!checkBody(Body, req.body, res)) return;

	const { server, uuid }

	try {
		const serverInformation = await db.all('SELECT * FROM subusers WHERE serverId = ?', [
			server,
		]);


	}
});

app.post('/server/:id/subusers', async (req: Request, res: Response) => {
	const Body = {
		'uuid': '',
		'subuserUUID': '',
		'permissions': [],
		'key': '',
		'server': '',
	}
	if(!checkBody(Body, req.body, res)) return;

	const {
		uuid,
		subuserUUID,
		permissions,
		key,
		server,
	} = req.body;

	// Verify provided UUIDs
	const uuidRegex = /^[a-f0-9]{24}$/;
	if(!uuidRegex.test(uuid) || !uuidRegex.test(subuserUUID))
		return res.status(400).json({
			error: 'An invalid UUID was provided.',
		});

	// Verify that user exists
	try {
		var accountsWithUUID = await db.all('SELECT * FROM info WHERE uuid = ?', [
			uuid
		]);
	} catch (e) {
		console.error(e);
		res.status(500).json({
			error: 'An error occurred validating the provided user UUID.',
		});
	}
	
	if(accountsWithUUID.length <= 0) 
		return res.status(400).json({
			error: `There is no account with the UUID '${uuid}.'`,
		});
	
	if(!(await compare(key, accountsWithUUID[0].key)))
		return res.status(400).json({
			error: 'Not authorized.',
		});
	
	// Verify that subuser exists
	try {
		var accountsWithSubuserUUID = await db.all('SELECT * FROM info WHERE uuid = ?', [
			subuserUUID
		]);
	} catch (e) {
		console.error(e);
		res.status(500).json({
			error: 'An error occurred validating the provided subuser UUID.',
		});
	}

	if(accountsWithSubuserUUID.length <= 0)
		return res.status(400).json({
			error: `There is no account with the UUID '${subuserUUID}.'`,
		});
	
	// Verify server id
	if(!/^[0-9a-f]{24}$/.test(server))
		return res.status(400).json({
			error: `Invalid server ID.`,
		});

	// Verify that server exists
	const serverResponse = await unirest.get(`https://api.minehut.com/server/${server}`);
	if(serverResponse.status !== 200 && serverResponse.status !== 500)
		return res.status(500).json({
			error: `An error occurred validating the existence of the server with the ID '${server}.'`,
		});
	else if(serverResponse.status === 500)
		return res.status(400).json({
			error: `There exists no server with the ID '${server}.'`,
		});
	
	// Preparation for next two steps
	try {
		var serverInformation = await db.all('SELECT * FROM subusers WHERE serverId = ?', [
			server,
		]);
	} catch (e) {
		console.error(e);
		return res.status(500).json({
			error: 'An error occurred fetching subusers information.',
		});
	}

	
	const { subusers: _subusers } = serverInformation.length === 0 ? { subusers: '[]' } : serverInformation[0];
	
	// Update subusers information
	try {
		let subusers = JSON.parse(_subusers);
		if(!Array.isArray(subusers))
			subusers = [];
		
		// If subuser already exists, override permissions
		for(const subuser of subusers)
			if(subuser.uuid === subuserUUID) {
				subuser.permissions = permissions;
				var exists = true;
			}

		if(typeof exists !== 'boolean') subusers.push({ permissions, uuid: subuserUUID });
		
		try {
			await db.run('INSERT OR REPLACE INTO subusers(serverId, subusers) VALUES(?, ?)', [
				server,
				JSON.stringify(subusers),
			]);
		} catch (e) {
			console.error(e);
			return res.status(500).json({
				error: 'An error occurred updating subusers information',
			});
		}
		res.status(200).json({ subusers });
	} catch (e) {
		console.error(e);
		return res.status(500).json({
			error: 'An error occurred updating subusers information (Invalid array of subusers found!).',
		});
	}
});

app.delete('/server/:id/subusers', async (req: Request, res: Response) => {
	const Body = {
		'uuid': '',
		'subuserUUID': '',
		'key': '',
		'server': '',
	}
	if(!checkBody(Body, req.body, res)) return;

	const { uuid, subuserUUID, key, server } = req.body;

	// Verify provided UUIDs
	const uuidRegex = /^[a-f0-9]{24}$/;
	if(!uuidRegex.test(uuid) || !uuidRegex.test(subuserUUID))
		return res.status(400).json({
			error: 'An invalid UUID was provided.',
		});

	// Verify that user exists
	try {
		var accountsWithUUID = await db.all('SELECT * FROM info WHERE uuid = ?', [
			uuid
		]);
	} catch (e) {
		console.error(e);
		res.status(500).json({
			error: 'An error occurred validating the provided user UUID.',
		});
	}
	
	if(accountsWithUUID.length <= 0) 
		return res.status(400).json({
			error: `There is no account with the UUID '${uuid}.'`,
		});
	
	if(!(await compare(key, accountsWithUUID[0].key)))
		return res.status(400).json({
			error: 'Not authorized.',
		});
	
	// Verify that subuser exists
	try {
		var accountsWithSubuserUUID = await db.all('SELECT * FROM info WHERE uuid = ?', [
			subuserUUID
		]);
	} catch (e) {
		console.error(e);
		res.status(500).json({
			error: 'An error occurred validating the provided subuser UUID.',
		});
	}

	if(accountsWithSubuserUUID.length <= 0)
		return res.status(400).json({
			error: `There is no account with the UUID '${subuserUUID}.'`,
		});
	

	// Verify server id
	if(!/^[0-9a-f]{24}$/.test(server))
		return res.status(400).json({
			error: `Invalid server ID.`,
		});

	// Verify that server exists
	const serverResponse = await unirest.get(`https://api.minehut.com/server/${server}`);
	if(serverResponse.status !== 200 && serverResponse.status !== 500)
		return res.status(500).json({
			error: `An error occurred validating the existence of the server with the ID '${server}.'`,
		});
	else if(serverResponse.status === 500)
		return res.status(400).json({
			error: `There exists no server with the ID '${server}.'`,
		});
	
	// Fetch subusers information
	try {
		const _serverInformation = await db.all('SELECT subusers FROM subusers WHERE serverId = ?', [
			server,
		]);
		var subusers: { permissions: string[]; uuid: string }[] = JSON.parse((_serverInformation[0] ?? { subusers: '[]' }).subusers);			
		if(!Array.isArray(subusers))
			return res.status(500).json({
				error: 'An error occurred fetching subusers information.',
			});
	} catch (e) {
		console.error(e);
		return res.status(500).json({
			error: 'An error occurred fetching subusers information.',
		});
	}

	
	// Update subusers information
	for(const subuser in subusers)
		if(subusers[subuser].uuid == subuserUUID)
			subusers.splice(parseInt(subuser), parseInt(subuser) + 1);
	
		
	await db.run('INSERT OR REPLACE INTO subusers(serverId, subusers) VALUES(?, ?)', [
		server,
		JSON.stringify(subusers),
	]);

	res.status(200).json({ subusers });
});

app.get('/server/:id/subusers', async (req, res) => {
	const Body = {
		'uuid': '',
		'key': '',
		'server': '',
	}
	if(!checkBody(Body, req.body, res)) return;

	const { uuid, key, server } = req.body;

	// Verify provided UUIDs
	const uuidRegex = /^[0-9a-f]{24}$/;
	if(!uuidRegex.test(uuid))
		return res.status(400).json({
			error: 'An invalid UUID was provided.',
		});

	// Verify that user exists
	try {
		var accountsWithUUID = await db.all('SELECT * FROM info WHERE uuid = ?', [
			uuid
		]);
	} catch (e) {
		console.error(e);
		res.status(500).json({
			error: 'An error occurred validating the provided user UUID.',
		});
	}
	
	if(accountsWithUUID.length <= 0) 
		return res.status(400).json({
			error: `There is no account with the UUID '${uuid}.'`,
		});
	
	if(!(await compare(key, accountsWithUUID[0].key)))
		return res.status(400).json({
			error: 'Not authorized.',
		});
	
	// Fetch subuser information
	const subuserInformation = await db.all('SELECT subusers FROM subusers WHERE serverId = ?', [
		server
	]);
	
	res.status(200).json({ subusers: JSON.parse((subuserInformation[0] ?? { subusers: '[]' }).subusers) });
});

app.listen(port, () => { console.log('Ready.') });