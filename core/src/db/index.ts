import { env } from "cloudflare:workers";
import { IS_DEV } from "rwsdk/constants";

type Create_user = { data: { username: string } };
type User_Profile = {
    id: string;
    username: string;
    createdAt: Date;
} | null
    ;
type Create_credential = { data: { userId: string, credentialId: string, publicKey: Uint8Array<ArrayBufferLike>, counter: number } };

type DB_Credential = {
    id: string;
    createdAt: Date;
    userId: string;
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
} | null


//WARNING: This is a placeholder till we swap in db
export const db = {
    user: {
        create: async ({ data }: Create_user) => {
            return { id: "test" }
        },
        findUnique: async ({ where }: { where: { id: string } }): Promise<User_Profile> => {
            return {
                id: "test",
                createdAt: new Date(),
                username: "test",
            }
        },
    },
    credential: {
        create: async ({ data }: Create_credential) => {
        },
        //TODO:REPLACE With drizzle call
        findUnique: async ({ where }: { where: { credentialId: string } }): Promise<DB_Credential> => {
            return {
                id: "test",
                createdAt: new Date(),
                userId: "test",
                credentialId: "test",
                publicKey: new Uint8Array(),
                counter: 0,
            }
        },

        //TODO:REPLACE With drizzle call
        update: async ({ where, data }: { where: { credentialId: string }, data: { counter: number } }) => {
            //TODO: Update the counter
            if (IS_DEV) console.log(where, data);
        }
    },

}


export type User = User_Profile;

export const setupDb = async (cf_env: typeof env) => {
    //TODO: Setup the db
    if (IS_DEV) console.log(cf_env);
}
