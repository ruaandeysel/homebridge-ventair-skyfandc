import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { HomebridgeVentairCeilingFan } from './platform';
import TuyAPI from 'tuyapi';
import TuyaDevice, { DPSObject } from 'tuyapi';

export class CeilingFanAccessory {
  private fanService!: Service;
  private lightService!: Service;

  private state = {
    fanStatus: 0,
    rotationDirection: 0,
    rotationSpeedStep: 1,
    swingMode: 0,
    lightOn: false,
    lightBrightness: 100,
  };

  constructor(
    private readonly platform: HomebridgeVentairCeilingFan,
    private readonly accessory: PlatformAccessory,
  ) {
    const device = new TuyAPI({
      id: accessory.context.device.id,
      key: accessory.context.device.key,
      ip: accessory.context.device.ip,
      version: accessory.context.device.version,
      issueRefreshOnConnect: true,
    });

    device.on('disconnected', () => {
      this.platform.log.info('Disconnected... Try to connect');
      this.connect(device);
    });
    device.on('error', error => {
      this.platform.log.info('Error :', error);
      this.platform.log.info('Try to connect');
      this.connect(device);
    });

    // Information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Ventair')
      .setCharacteristic(this.platform.Characteristic.Model, 'Ceiling Fan')
      .setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);

    // Fan
    this.fanService = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);
    this.fanService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // Fan state
    this.fanService.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(async (value: CharacteristicValue) => {
        this.state.fanStatus = value.valueOf() as number;
        await device.set({
          dps: 1,
          set: this.state.fanStatus === this.platform.Characteristic.Active.ACTIVE,
          shouldWaitForResponse: false,
        });
      })
      .onGet(() => this.state.fanStatus);

    const stateHook = (data: DPSObject) => {
      const isActive = data.dps['1'] as boolean | undefined;
      if (isActive !== undefined) {
        this.state.fanStatus = isActive ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
        this.platform.log.info('Update: Fan status ', isActive ? 'on' : 'off');
        this.fanService.updateCharacteristic(this.platform.Characteristic.Active, this.state.fanStatus);
      }
    };
    device.on('dp-refresh', stateHook);
    device.on('data', stateHook);

    // Fan rotation
    this.fanService.getCharacteristic(this.platform.Characteristic.RotationDirection)
      .onSet(async (value: CharacteristicValue) => {
        this.state.rotationDirection = value.valueOf() as number;
        await device.set({
          dps: 8,
          set: this.state.rotationDirection === this.platform.Characteristic.RotationDirection.CLOCKWISE ? 'forward' : 'reverse',
          shouldWaitForResponse: false,
        });
      })
      .onGet(() => this.state.rotationDirection);

    const rotationHook = (data: DPSObject) => {
      const rotation = data.dps['8'] as string | undefined;
      if (rotation !== undefined) {
        this.state.rotationDirection = rotation === 'forward'
          ? this.platform.Characteristic.RotationDirection.CLOCKWISE
          : this.platform.Characteristic.RotationDirection.COUNTER_CLOCKWISE;
        this.platform.log.info('Update: Fan rotation ',
          this.state.rotationDirection === this.platform.Characteristic.RotationDirection.CLOCKWISE ? 'clockwise' : 'counter-clockwise');
        this.fanService.updateCharacteristic(this.platform.Characteristic.RotationDirection, this.state.rotationDirection);
      }
    };
    device.on('dp-refresh', rotationHook);
    device.on('data', rotationHook);

    // Fan speed
    this.fanService.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onSet(async (value: CharacteristicValue) => {
        const speedPercent = value.valueOf() as number;
        const speedStep = Math.round((speedPercent / 100) * 4) + 1; // Map 0-100 to 1-5
        this.state.rotationSpeedStep = speedStep;

        await device.set({ dps: 3, set: speedStep, shouldWaitForResponse: false });

        if (speedPercent === 0 && this.state.fanStatus === this.platform.Characteristic.Active.ACTIVE) {
          this.state.fanStatus = this.platform.Characteristic.Active.INACTIVE;
          await device.set({ dps: 1, set: false, shouldWaitForResponse: false });
        } else if (speedPercent > 0 && this.state.fanStatus === this.platform.Characteristic.Active.INACTIVE) {
          this.state.fanStatus = this.platform.Characteristic.Active.ACTIVE;
        }
      })
      .onGet(() => {
        // Convert 1-5 step to 0-100 percent
        return Math.round(((this.state.rotationSpeedStep - 1) / 4) * 100);
      });

    const speedHook = (data: DPSObject) => {
      const speed = data.dps['3'] as number | undefined;
      if (speed !== undefined) {
        const percent = Math.round(((speed - 1) / 4) * 100); // Map 1-5 to 0-100
        this.state.rotationSpeedStep = speed;
        this.platform.log.info('Update: Fan speed (', percent, '% | speed: ', speed, ')');
        this.fanService.updateCharacteristic(this.platform.Characteristic.RotationSpeed, percent);
      }
    };
    device.on('dp-refresh', speedHook);
    device.on('data', speedHook);

    // Swing mode (representing fan modes)
    this.fanService.getCharacteristic(this.platform.Characteristic.SwingMode)
      .onSet(async (value: CharacteristicValue) => {
        const swingMode = value.valueOf() as number;
        this.state.swingMode = swingMode;

        let mode: string;
        switch (swingMode) {
          case this.platform.Characteristic.SwingMode.SWING_ENABLED:
            mode = 'nature';
            break;
          case this.platform.Characteristic.SwingMode.SWING_DISABLED:
            mode = 'smart';
            break;
          default:
            mode = 'sleep';
        }

        await device.set({
          dps: 2,
          set: mode,
          shouldWaitForResponse: false,
        });
      })
      .onGet(() => this.state.swingMode);

    const swingHook = (data: DPSObject) => {
      const mode = data.dps['2'] as string | undefined;
      if (mode !== undefined) {
        switch (mode) {
          case 'nature':
            this.state.swingMode = this.platform.Characteristic.SwingMode.SWING_ENABLED;
            break;
          case 'smart':
            this.state.swingMode = this.platform.Characteristic.SwingMode.SWING_DISABLED;
            break;
          case 'sleep':
            // HomeKit doesn't have a third mode, so we'll use SWING_DISABLED for sleep as well
            this.state.swingMode = this.platform.Characteristic.SwingMode.SWING_DISABLED;
            break;
        }
        this.platform.log.info('Update: Fan mode ', mode);
        this.fanService.updateCharacteristic(this.platform.Characteristic.SwingMode, this.state.swingMode);
      }
    };
    device.on('dp-refresh', swingHook);
    device.on('data', swingHook);

    if (accessory.context.device.hasLight) {
      // Fan Light
      this.lightService = this.accessory.getService(this.platform.Service.Lightbulb)
        || this.accessory.addService(this.platform.Service.Lightbulb);
      this.lightService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
      this.lightService.getCharacteristic(this.platform.Characteristic.On)
        .onSet(async (value: CharacteristicValue) => {
          this.state.lightOn = value.valueOf() as boolean;
          await device.set({ dps: 15, set: this.state.lightOn, shouldWaitForResponse: false });
          await device.refresh({});
        })
        .onGet(() => this.state.lightOn);

      const lightStateHook = (data: DPSObject) => {
        const isOn = data.dps['15'] as boolean | undefined;
        if (isOn !== undefined) {
          this.state.lightOn = isOn;
          this.platform.log.info('Update: Light ', this.state.lightOn ? 'on' : 'off');
          this.lightService.updateCharacteristic(this.platform.Characteristic.On, this.state.lightOn);
        }
      };
      device.on('dp-refresh', lightStateHook);
      device.on('data', lightStateHook);

      // Fan Light Brightness
      this.lightService.getCharacteristic(this.platform.Characteristic.Brightness)
        .onSet(async (value: CharacteristicValue) => {
          this.state.lightBrightness = value.valueOf() as number;
          await device.set({ dps: 16, set: this.state.lightBrightness, shouldWaitForResponse: false });

          if (this.state.lightBrightness === 0 && this.state.lightOn) {
            await device.set({ dps: 15, set: false, shouldWaitForResponse: false });
          } else if (this.state.lightBrightness > 0 && !this.state.lightOn) {
            await device.set({ dps: 15, set: true, shouldWaitForResponse: false });
          }
        })
        .onGet(() => this.state.lightBrightness);

      const lightBrightnessHook = (data: DPSObject) => {
        const brightness = data.dps['16'] as number | undefined;
        if (brightness !== undefined) {
          this.state.lightBrightness = brightness;
          this.platform.log.info('Update: Brightness ', this.state.lightBrightness, '%');
          this.lightService.updateCharacteristic(this.platform.Characteristic.Brightness, this.state.lightBrightness);
        }
      };
      device.on('dp-refresh', lightBrightnessHook);
      device.on('data', lightBrightnessHook);
    }

    this.connect(device);
  }

  async connect(device: TuyaDevice) {
    try {
      this.platform.log.info('Connecting...');
      await device.find();
      await device.connect();
      this.platform.log.info('Connected');
    } catch (e) {
      this.platform.log.info('Connection failed', e);
      this.platform.log.info('Retry in 1 minute');
      setTimeout(() => this.connect(device), 60000);
    }
  }
}