"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env.DEBUG = '*';
const tuyapi_1 = __importDefault(require("tuyapi"));
describe('Ceiling Fan Accessory', () => {
    jest.setTimeout(30000);
    it('should be able to turn on', async () => {
        const device = new tuyapi_1.default({
            // id: 'bff9ec0**d1763trij',
            // key: 'E{***+WF6DeP',
            'id': 'bfc4e4***d5pzdr',
            'key': 'BU2ai**ZKrX@dQJ',
        });
        await device.find();
        await device.connect();
        // const dataRefresh = await new Promise((resolve) => device.on('dp-refresh', (data) =>resolve(data)));
        const data = await new Promise((resolve) => device.on('data', (data) => resolve(data)));
        // @ts-ignore
        console.log(data);
        // console.log(dataRefresh);
    });
});
