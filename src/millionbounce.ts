import { EventEmitter } from "events";

// Represents a MasterAMillionBall bouncy ball. Things to know:
//
// - The first time you register a ball, you'll need to set the ID. If it's just
//   blinking red for a couple of minutes, that means it's uninitialized and
//   needs an ID. If the ID isn't set within ~2 minutes, bluetooth shuts down.
//
// - After an ID is set, the ball will blink red 3 times every time you bounce
//   it. This will start bluetooth up for something like 20 seconds. AFAICT
//   there is no keep alive outside of bouncing the ball more, which resets the
//   timer. After that, the ball just shuts down until bounced again. That makes
//   this less than useful for WebBluetooth, which requires user gesture
//   reconnects every time the device disconnects. I'm not sure if there's a
//   protocol based keepalive yet.
export class MasterAMillionBall extends EventEmitter {

  // Bluetooth device name. Not exactly surprising.
  public static readonly BLE_NAME: string = "MAM";

  // These are the only 2 characteristics we care about on the device. These
  // basically work like the rx/tx lines of a serial connection, which is a
  // pretty common setup for bluetooth. We'll write values to the characteristic
  // denoted by WRITE_CHAR_UUID, and if the values we write are commands that
  // have output, those will be sent back over the characteristic denoted by
  // NOTIFY_CHAR_UUID.
  public static readonly MAM_SERVICE: string = "0000fff3-0000-1000-8000-00805f9b34fb";
  public static readonly NOTIFY_CHAR_UUID: string = "0000fff4-0000-1000-8000-00805f9b34fb";
  public static readonly WRITE_CHAR_UUID: string = "0000fff5-0000-1000-8000-00805f9b34fb";

  // The actual representations of the device.
  private _device: BluetoothDevice | null = null;
  private _server: BluetoothRemoteGATTServer | null = null;
  private _notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
  private _writeChar: BluetoothRemoteGATTCharacteristic | null = null;
  private _ballId: number | null = null;

  constructor() {
    super();
  }

  // To connect, we'll need to do a few things.
  //
  // - Form scanning filters
  public async Connect(): Promise<void> {
    // Form scanning filters. This will require the name of the device, and the
    // service that our characteristics inhabit.
    const filters = {
      filters: [{namePrefix: MasterAMillionBall.BLE_NAME}],
      optionalServices: [MasterAMillionBall.MAM_SERVICE],
    };

    // At some point, we should use navigator.bluetooth.getAvailability() to
    // check whether we have a radio to use. However, no browser currently
    // implements this. Instead, see if requestDevice throws;
    try {
      this._device = await navigator.bluetooth.requestDevice(filters);
    } catch (e) {
      // This is the only way we have to check whether the user cancelled out of
      // the dialog versus bluetooth radio not being available, as both errors
      // are thrown as DOMExcpetion. Kill me.
      if (e.message.indexOf("User cancelled") !== -1) {
        return;
      }
      throw new Error("Bluetooth scanning interrupted. " +
                      "Either user cancelled out of dialog, " +
                      "or bluetooth radio is not available. Exception: " + e);
    }

    try {
      this._server = await this._device.gatt!.connect();
    } catch (e) {
      console.log(e);
      throw e;
    }

    const services = await this._server.getPrimaryServices();
    if (services.length === 0) {
      throw new Error(`Cannot find gatt service to connect to on device ${this._device.name}`);
    }

    const service = services.find((x) => x.uuid === MasterAMillionBall.MAM_SERVICE);
    const chrs = await service!.getCharacteristics();
    for (const chr of chrs) {
      if (chr.uuid === MasterAMillionBall.WRITE_CHAR_UUID) {
        this._writeChar = chr;
      } else if (chr.uuid === MasterAMillionBall.NOTIFY_CHAR_UUID) {
        this._notifyChar = chr;
      }
    }

    // Once we have our characteristics, actually subscribe to our notification
    // to make sure we get updates.
    this._notifyChar!.addEventListener("characteristicvaluechanged", (e) => this.CharacteristicValueChanged(e));
    await this._notifyChar!.startNotifications();
  }

  public Disconnect() {
    if (!this.Connected) {
      return;
    }
    this._server!.disconnect();
  }

  public get Connected(): boolean {
    return this._server !== null && this._server.connected;
  }

  public async SetId(aId: number) {
    const cmd = Array(8).fill(0);
    // Command byte to set the ID on the device.
    cmd[0] = 0x49; // "I"

    // 24 bit ID, bigendian, spread across 3 bytes
    cmd[4] = aId >> 0x10 & 0xff;
    cmd[5] = aId >> 0x8 & 0xff;
    cmd[6] = aId & 0xff;

    // CRC calculation. Seems to be the only packet that requires CRC?
    cmd[7] = cmd.reduce((sum, x) => sum + x, 0) & 0xff;

    this.WriteToDevice(cmd);
  }

  public async GetId() {
  }

  public async GetCount() {
    const cmd = [0x56, 0x0];
    this.WriteToDevice(cmd);
  }

  public async SetCount() {
  }

  public async ResetCount() {
    const cmd = Array(7).fill(0);
    cmd[0] = 0x43; // "C"

    cmd[4] = this._ballId! >> 0x10 & 0xff;
    cmd[5] = this._ballId! >> 0x8 & 0xff;
    cmd[6] = this._ballId! & 0xff;
    this.WriteToDevice(cmd);
  }

  public async FactoryReset() {
    // Forms string "T1S2". Dunno why.
    const cmd = [0x54, 0x31, 0x53, 0x32];
    this.WriteToDevice(cmd);
  }

  private WriteToDevice(aArray: number[]) {
    if (!this.Connected) {
      return;
    }
    this._writeChar!.writeValue(Uint8Array.from(aArray));
  }

  private CharacteristicValueChanged = (aEvent: Event) => {
    const view = (aEvent.target! as BluetoothRemoteGATTCharacteristic).value!.buffer;
    const b = new Uint8Array(view, 0, view.byteLength);

    // TODO assert b[0] == 0x56 Here

    // Too bad there's no such thing as a Uint24Array, huh?
    const id = (b[1] << 16) + (b[2] << 8) + (b[3]);
    const count = (b[4] << 16) + (b[5] << 8) + (b[6]);
    this.emit("update", {id, count});
  }
}
