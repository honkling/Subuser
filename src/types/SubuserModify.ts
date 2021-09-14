import { Permission } from "./Permission";

export interface SubuserModify {
	uuid: string,
	permissions: Permission[],
}