import { Injectable, NotFoundException } from '@nestjs/common';
import type { MultipartFile } from '@fastify/multipart';
import { MessagesQueueService } from './messages-queue.service';
import { clearDevice, flashRgb } from 'src/utils/ble';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from '../devices/device.schema';

@Injectable()
export class MessagesService {
  constructor(
    private readonly queue: MessagesQueueService,
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
  ) { }

  async setImage(deviceId: string, file: MultipartFile): Promise<void> {
    await this.queue.runExclusive(deviceId, 'setImage', async () => {
      const device = await this.deviceModel.findById(deviceId).exec();
      if (!device) {
        throw new NotFoundException('Device not found');
      }
      const address = device.ble.address;
      await this.sendAndWaitAck(address, 'setImage', { file });
    });
  }

  async clearImage(deviceId: string): Promise<void> {
    await this.queue.runExclusive(deviceId, 'clearImage', async () => {
      const device = await this.deviceModel.findById(deviceId).exec();
      if (!device) {
        throw new NotFoundException('Device not found');
      }
      const address = device.ble.address;
      await this.sendAndWaitAck(address, 'clearImage');
    });
  }

  async flash(deviceId: string, color: string): Promise<void> {
    await this.queue.runExclusive(deviceId, 'flash', async () => {
      const device = await this.deviceModel.findById(deviceId).exec();
      if (!device) {
        throw new NotFoundException('Device not found');
      }
      const address = device.ble.address;
      await this.sendAndWaitAck(address, 'flash', { color });
    });
  }

  private async sendAndWaitAck(
    address: string,
    type: 'setImage' | 'clearImage' | 'flash',
    payload?: unknown,
    timeoutMs = 10000,
  ): Promise<void> {
    switch (type) {
      case 'clearImage':
        clearDevice(address);
        return;
      case 'setImage':
        return;
      case 'flash':
        const rgb = this.hexToRgb((payload as { color: string }).color) ?? { r: 255, g: 0, b: 0 };
        flashRgb(address, { red: rgb.r, green: rgb.g, blue: rgb.b, offMs: 1000, onMs: 1000, workMs: 10000 });
        return;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  private hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
}
