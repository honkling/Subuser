import e from 'express';
import { Request, Response } from 'express';
import { join } from 'path';

const app = e();
const { port } = require(join(__dirname, '../config.json'));

app.post('/server/:id/create_subuser', (req: Request, res: Response) => {

});

app.listen(port, () => {});