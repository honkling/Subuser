import { compareSync } from "bcrypt";
import { hashPassword } from "../util/Util";

hashPassword("hey")
	.then((i) => {
		console.log(compareSync("hey", i.password));
	})
	.catch(console.error);