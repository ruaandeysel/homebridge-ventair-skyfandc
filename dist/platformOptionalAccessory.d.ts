import { PlatformAccessory } from 'homebridge';
import { HomebridgeSkyfanCeilingFan } from './platform';
import TuyaDevice from 'tuyapi';
export declare class ToggleCeilingFanAccessory {
    private readonly platform;
    private readonly accessory;
    private fanService;
    private lightService;
    private state;
    constructor(platform: HomebridgeSkyfanCeilingFan, accessory: PlatformAccessory);
    connect(device: TuyaDevice): Promise<void>;
}
//# sourceMappingURL=platformOptionalAccessory.d.ts.map