import { DurableObject } from "cloudflare:workers";


export class SyncDurableObject extends DurableObject {
    constructor(state: DurableObjectState, env: any) {
        super(state, env);
    }

}
