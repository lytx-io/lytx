import { DurableObject } from "cloudflare:workers";


export class SyncDurableObject extends DurableObject {
    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
    }

}
