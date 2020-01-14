const { promisify } = require('util');

export default class Snapshot {
    private provider:any;
    public id = "";

    constructor(provider:any){
        this.provider = provider;
        (async () => await this.saveSnapshot());
    }

    public async revert() {
        await this.rpc("evm_revert", [this.id]);
        await this.saveSnapshot();
    };
    private async saveSnapshot() {
        this.id = (await this.rpc("evm_snapshot")).result;
    };

    private async rpc(method:string, arg?:Array<any>) {
        let request = {
            jsonrpc: "2.0",
            method: method,
            id: Date.now(),
            params: arg
        };

        let result = await promisify(this.provider.send.bind(this.provider))(request);
        if (result.error != null) {
            throw new Error("RPC Error: " + (result.error.message || result.error));
        }
        return result;
    };
}
