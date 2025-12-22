import { Injectable, NotFoundException } from '@nestjs/common';
import type { MultipartFile } from '@fastify/multipart';
import { MessagesQueueService } from './messages-queue.service';
import { clearDevice, flashRgb, sendFrameNonCompressedA500A501 } from 'src/utils/ble';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from '../devices/device.schema';
import sharp from 'sharp';
import { convertRgbaToEslFrameSized, type RgbaImage } from 'src/utils/ble_colour_helper';

@Injectable()
export class MessagesService {
  constructor(
    private readonly queue: MessagesQueueService,
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
  ) { }

  async setImage(deviceId: string, file: MultipartFile): Promise<void> {
    try {
      await this.queue.runExclusive(deviceId, 'setImage', async () => {
        const device = await this.deviceModel.findById(deviceId).exec();
        if (!device) {
          throw new NotFoundException('Device not found');
        }
        const address = device.ble.address;
        await this.sendAndWaitAck(address, 'setImage', { file, width: device.ble.width, height: device.ble.height });
      });
    } catch (error) {
      console.error(`Failed to set image on device ${deviceId}:`, error);
    }
  }

  async clearImage(deviceId: string): Promise<void> {
    try {
      await this.queue.runExclusive(deviceId, 'clearImage', async () => {
        const device = await this.deviceModel.findById(deviceId).exec();
        if (!device) {
          throw new NotFoundException('Device not found');
        }
        const address = device.ble.address;
        await this.sendAndWaitAck(address, 'clearImage');
      });
    } catch (error) {
      console.error(`Failed to clear image on device ${deviceId}:`, error);
    }

  }

  async flash(deviceId: string, color: string): Promise<void> {
    try {
      await this.queue.runExclusive(deviceId, 'flash', async () => {
        const device = await this.deviceModel.findById(deviceId).exec();
        if (!device) {
          throw new NotFoundException('Device not found');
        }
        const address = device.ble.address;
        await this.sendAndWaitAck(address, 'flash', { color });
      });
    } catch (error) {
      console.error(`Failed to flash device ${deviceId} with color ${color}:`, error);
    }
  }

  private async sendAndWaitAck(
    address: string,
    type: 'setImage' | 'clearImage' | 'flash',
    payload?: unknown,
    timeoutMs = 10000,
  ): Promise<void> {
    switch (type) {
      case 'clearImage':
        await clearDevice(address);
        return;
      case 'setImage':
        {
          const file = (payload as { file: MultipartFile, width?: number, height?: number }).file;
          if (!file) throw new Error('No image file provided');

          const buffer = await this.readMultipartFile(file);

          const { data, info } = await sharp(buffer)
            .rotate()
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

          const rgba: RgbaImage = {
            width: info.width,
            height: info.height,
            data: new Uint8ClampedArray(data),
          };

          const targetWidth = (payload as { width?: number }).width ?? 400;
          const targetHeight = (payload as { height?: number }).height ?? 300;
          const frameArray = convertRgbaToEslFrameSized(rgba, targetWidth, targetHeight);
          const frameBytes = Uint8Array.from(frameArray);

          await sendFrameNonCompressedA500A501(address, frameBytes);
          return;
        }
      case 'flash':
        const rgb = this.hexToRgb((payload as { color: string }).color) ?? { r: 255, g: 0, b: 0 };
        await flashRgb(address, { red: rgb.r, green: rgb.g, blue: rgb.b, offMs: 1000, onMs: 1000, workMs: 10000 });
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

  private async readMultipartFile(file: MultipartFile): Promise<Buffer> {
    const anyFile = file as unknown as { toBuffer?: () => Promise<Buffer>; file?: NodeJS.ReadableStream };
    if (typeof anyFile.toBuffer === 'function') {
      return await anyFile.toBuffer();
    }
    if (anyFile.file) {
      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        anyFile.file!.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        anyFile.file!.on('error', reject);
        anyFile.file!.on('end', () => resolve(Buffer.concat(chunks)));
      });
    }
    throw new Error('Unsupported MultipartFile: no buffer or stream');
  }
}
