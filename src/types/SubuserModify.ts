import { Permission } from "./Permission";

export interface SubuserModify {
	email: string,
	permissions: Permission[],
}