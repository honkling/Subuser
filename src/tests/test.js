const unirest = require('unirest');
const Database = require('sqlite-async');


const data = {
	subuserUUID: '5ee776f795726c00589a78ca',
	uuid: '5a820e46c7c4ce32cd0aba36',
	key: 'd09927ca-caf1-4f1e-b3a9-fe089f593dab',
	server: '5a820ea2da29f932a0ef53a5',
	permissions: [':)', ':>', ':]'],
}

unirest.get(`http://localhost:3000/proxy/server/${data.server}`).then(r=>console.log(r.body));
//unirest.get('http://localhost:3000/test/bruh').then(r=>console.log(r.status));

/*unirest.get(`http://localhost:3000/server/${data.server}/subusers`)
	.send(data)
	.then((r) => {
		console.log(JSON.stringify(r.body));
	});*/

/*const data = {
	slgUser: "e066c9da-3592-4b64-b204-f66b180a3e1c",
	slgSession: "5c95cff2-b342-4cb8-86ab-198133a8a20b",
	token: "52637e7c-7723-48ab-a311-cbdab0302ae3",
}

unirest.post('http://localhost:3000/user/generate_key')
	.send(data)
	.then((r) => {
		console.log(r.body);
	});*/

/*const data = {
	uuid: '5a820e46c7c4ce32cd0aba36',
	key: '2810a245-4abf-4008-a7f8-4cfc0000246f',
	server: '5a820ea2da29f932a0ef53a5',
	subuserUUID: ''
}

unirest.post(`http://localhost:3000/server/${server}/subusers`)*/

/*const data = {
	slgUser: "459563af-269d-4dda-be09-fc2fe95f0f46",
	slgSession: "8eea5c39-3972-49f5-94b3-2339bbb5bb68",
	token: "5c7ad180-bc41-413b-b61d-fb002ffc377c",
}

unirest.post('http://localhost:3000/user/generate_key')
	.send(data)
	.then((r) => {
		console.log(r.body);
	});*/