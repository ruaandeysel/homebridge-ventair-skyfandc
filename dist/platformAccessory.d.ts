import { PlatformAccessory } from 'homebridge';
import { HomebridgeSkyfanCeilingFan } from './platform';
import TuyaDevice from 'tuyapi';
export declare class CeilingFanAccessory {
    private readonly platform;
    private readonly accessory;
    private fanService;
    private lightService;
    private lightToggleService;
    private fanToggleService;
    private state;
    constructor(platform: HomebridgeSkyfanCeilingFan, accessory: PlatformAccessory);
    connect(device: TuyaDevice): Promise<void>;
    toStep(percent: number): number;
    toPercent(initialPercentage: number, step: number): number;
    convertTemperatureHomeKit(tuyaValue: number): 140 | 320 | 500;
    convertTemperatureTuya(homekitValue: number): 0 | 500 | 1000;
}
//# sourceMappingURL=platformAccessory.d.ts.map