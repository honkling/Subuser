import Database from 'sqlite-async';
import { join } from 'path';
import { genSalt, hash } from 'bcrypt';
import { Response } from 'express';

let database: Database;

export async function getMain(): Promise<Database> {
	return database ?? (database = Database.open(join(__dirname, '../../main.db')));
}

export async function hashPassword(password: string, salt?: string) {
	if(!salt) salt = await genSalt(10);
	return {
		salt,
		password: await hash(password, salt),
	}
}

export function checkBody(T: object, body: { [name: string]: unknown }, res: Response): boolean {
	type T = typeof T;
	const missingFields = [];
	for(const property of Object.keys(T)) {
		if(!body[property]) missingFields.push(property);
	}
	if(missingFields.length > 0) {
		res.status(400).json({ error: `Invalid request. Please supply the fields '${missingFields.join('\', \'')}.'` });
		return false;
	}
	return true;
}