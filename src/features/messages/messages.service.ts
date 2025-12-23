import { Injectable, NotFoundException } from '@nestjs/common';
import type { MultipartFile } from '@fastify/multipart';
import { MessagesQueueService } from './messages-queue.service';
import { clearDevice, flashRgb, sendFrameNonCompressedA500A501 } from 'src/utils/ble';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Device, DeviceDocument } from '../devices/device.schema';
import sharp from 'sharp';
import { convertRgbaToEslFrameSized, type RgbaImage } from 'src/utils/ble_colour_helper';
import { ApnsService } from '../notifications/apns.service';
import { User, UserDocument } from '../users/user.schema';
import { ApnsToken, ApnsTokenDocument } from '../users/apns.schema';

@Injectable()
export class MessagesService {
  constructor(
    private readonly queue: MessagesQueueService,
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ApnsToken.name) private readonly apnsModel: Model<ApnsTokenDocument>,
    private readonly apns: ApnsService,
  ) { }

  async readFileFromMultipart(file: MultipartFile): Promise<Buffer> {
    return this.readMultipartFile(file);
  }

  async processImageInBackground(deviceId: string, fileBuffer: Buffer, initiatingUserId?: string): Promise<void> {
    this.queue.queueBackgroundTask(deviceId, 'setImage', async () => {
      try {
        const device = await this.deviceModel.findById(deviceId).exec();
        if (!device) {
          console.error(`Device not found: ${deviceId}`);
          return;
        }
        
        const address = device.ble.address;
        const result = await this.processImageData(address, fileBuffer, device.ble.width, device.ble.height, deviceId);
        await this.notifyHomeUsers(device, `Image Updated`, `Device ${device.name} image updated successfully.`, result?.previewUrl);
      } catch (error) {
        console.error(`Failed to process image for device ${deviceId}:`, error);
        await this.deviceModel.updateOne(
          { _id: deviceId },
          {
            $set: { 'shadow.lastError': String(error) },
            $push: { 'shadow.lastErrors': { $each: [String(error)], $slice: -20 } }
          }
        ).exec().catch(e => console.error('Failed to update device error state:', e));
        
        if (initiatingUserId) {
          await this.notifyUser(initiatingUserId, 'Image Failed', `The request to update a device's image failed - please try again.`).catch(e => console.error('Failed to notify user:', e));
        }
      } finally {
        console.log(`[Service] processImageInBackground task completed for device ${deviceId}`);
      }
    });
  }

  async clearImageInBackground(deviceId: string, initiatingUserId?: string): Promise<void> {
    this.queue.queueBackgroundTask(deviceId, 'clearImage', async () => {
      try {
        const device = await this.deviceModel.findById(deviceId).exec();
        if (!device) {
          console.error(`Device not found: ${deviceId}`);
          return;
        }

        const address = device.ble.address;
        await clearDevice(address);
        
        await this.deviceModel.updateOne(
          { _id: deviceId },
          {
            $set: {
              'shadow.currentImagePreviewBase64': null,
              'shadow.currentImagePreviewType': null,
              'shadow.currentImagePreviewWidth': null,
              'shadow.currentImagePreviewHeight': null,
              'shadow.lastSuccessfulActionAt': new Date(),
              'shadow.lastSeenAt': new Date(),
              'shadow.lastError': null
            }
          },
        ).exec();
        
        await this.notifyHomeUsers(device, `Cleared`, `Device ${device.name} image cleared successfully.`);
      } catch (error) {
        console.error(`Failed to clear image on device ${deviceId}:`, error);
        await this.deviceModel.updateOne(
          { _id: deviceId },
          {
            $set: { 'shadow.lastError': String(error) },
            $push: { 'shadow.lastErrors': { $each: [String(error)], $slice: -20 } }
          }
        ).exec().catch(e => console.error('Failed to update device error state:', e));
        
        if (initiatingUserId) {
          await this.notifyUser(initiatingUserId, 'Clear Failed', `The request to clear a device's image failed - please try again.`).catch(e => console.error('Failed to notify user:', e));
        }
      } finally {
        console.log(`[Service] clearImageInBackground task completed for device ${deviceId}`);
      }
    });
  }

  async flashInBackground(deviceId: string, color: string, initiatingUserId?: string): Promise<void> {
    this.queue.queueBackgroundTask(deviceId, 'flash', async () => {
      console.log(`[Task] flashInBackground task starting for ${deviceId}`);
      try {
        const device = await this.deviceModel.findById(deviceId).exec();
        console.log(`[Task] Device found: ${!!device}`);
        if (!device) {
          console.error(`Device not found: ${deviceId}`);
          return;
        }

        const address = device.ble.address;
        const rgb = this.hexToRgb(color) ?? { r: 255, g: 0, b: 0 };
        console.log(`[Task] About to call flashRgb`);
        await flashRgb(address, { red: rgb.r, green: rgb.g, blue: rgb.b, offMs: 1000, onMs: 1000, workMs: 10000 });
        console.log(`[Task] flashRgb completed`);
        
        console.log(`[Task] Updating device shadow`);
        await this.deviceModel.updateOne(
          { _id: deviceId },
          { $set: { 'shadow.lastFlashed': new Date(), 'shadow.flashedFor': 10, 'shadow.lastSuccessfulActionAt': new Date(), 'shadow.lastSeenAt': new Date(), 'shadow.lastError': null } },
        ).exec();
        console.log(`[Task] Device shadow updated`);
        
        console.log(`[Task] About to notify home users`);
        await this.notifyHomeUsers(device, `Flashed`, `Device ${device.name} flashed successfully.`);
        console.log(`[Task] Home users notified`);
      } catch (error) {
        console.error(`Failed to flash device ${deviceId} with color ${color}:`, error);
        console.log(`[Task] In catch block, updating error state`);
        await this.deviceModel.updateOne(
          { _id: deviceId },
          {
            $set: { 'shadow.lastError': String(error) },
            $push: { 'shadow.lastErrors': { $each: [String(error)], $slice: -20 } }
          }
        ).exec().catch(e => console.error('Failed to update device error state:', e));
        console.log(`[Task] Error state updated`);
        
        if (initiatingUserId) {
          console.log(`[Task] Notifying user of failure`);
          await this.notifyUser(initiatingUserId, 'Flash Failed', `The request to flash a device failed - please try again.`).catch(e => console.error('Failed to notify user:', e));
          console.log(`[Task] User notified of failure`);
        }
      } finally {
        console.log(`[Task] flashInBackground finally block for device ${deviceId}`);
      }
      console.log(`[Task] flashInBackground task returning for ${deviceId}`);
    });
  }

  private async processImageData(address: string, buffer: Buffer, targetWidth: number, targetHeight: number, deviceId?: string): Promise<{ previewUrl?: string }> {
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

    const frameArray = convertRgbaToEslFrameSized(rgba, targetWidth, targetHeight);
    const frameBytes = Uint8Array.from(frameArray);

    await sendFrameNonCompressedA500A501(address, frameBytes);

    const thumbWidth = Math.max(200, targetWidth);
    const thumbHeight = Math.max(1, Math.round(thumbWidth * (targetHeight / targetWidth)));
    const preview = await sharp(buffer)
      .rotate()
      .resize(targetWidth, targetHeight, { fit: 'fill' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 100 })
      .toBuffer();
    const base64 = `data:image/jpeg;base64,${preview.toString('base64')}`;

    if (deviceId) {
      await this.deviceModel.updateOne(
        { _id: deviceId },
        {
          $set: {
            'shadow.currentImagePreviewBase64': base64,
            'shadow.currentImagePreviewType': 'image/jpeg',
            'shadow.currentImagePreviewWidth': thumbWidth,
            'shadow.currentImagePreviewHeight': thumbHeight,
            'shadow.lastSuccessfulActionAt': new Date(),
            'shadow.lastSeenAt': new Date(),
            'shadow.lastError': null,
          }
        },
      ).exec();
    }
    return { previewUrl: base64 };
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
      try {
        return await anyFile.toBuffer();
      } catch (e) {
        console.error('Error calling toBuffer():', e);
        throw new Error(`Failed to read file with toBuffer(): ${e}`);
      }
    }
    
    if (anyFile.file) {
      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const stream = anyFile.file!;
        
        stream.on('data', (chunk) => {
          try {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          } catch (e) {
            reject(new Error(`Error processing chunk: ${e}`));
          }
        });
        
        stream.on('error', (err) => {
          console.error('Stream error:', err);
          reject(err);
        });
        
        stream.on('end', () => {
          try {
            resolve(Buffer.concat(chunks));
          } catch (e) {
            reject(new Error(`Error concatenating chunks: ${e}`));
          }
        });
        
        const timeout = setTimeout(() => {
          reject(new Error('File read timeout after 30 seconds'));
        }, 30000);
        
        stream.on('end', () => clearTimeout(timeout));
        stream.on('error', () => clearTimeout(timeout));
      });
    }
    
    throw new Error('Unsupported MultipartFile: no buffer or stream');
  }

  private async notifyHomeUsers(device: DeviceDocument, title: string, body: string, imageUrl?: string): Promise<void> {
    setImmediate(async () => {
      try {
        console.log(`[Notify] Starting notifyHomeUsers for device ${device._id}`);
        const users = await this.userModel.find({ homeId: new Types.ObjectId(device.homeId) }).select('_id').exec();
        const userIds = users.map(u => u._id);
        console.log(`[Notify] Found ${userIds.length} users`);
        if (userIds.length === 0) {
          console.log(`[Notify] No users, returning early`);
          return;
        }
        
        const tokens = await this.apnsModel.find({ userId: { $in: userIds }, enabled: true }).select('token').exec();
        const tokenValues = tokens.map(t => t.token);
        console.log(`[Notify] Found ${tokenValues.length} tokens`);
        if (tokenValues.length === 0) {
          console.log(`[Notify] No tokens, returning early`);
          return;
        }
        
        console.log(`[Notify] Sending APNS notifications`);
        await this.apns.sendToTokens(tokenValues, { title, body }, { deviceId: String(device._id) }, 'alert', `device:${String(device._id)}`);
        console.log(`[Notify] APNS notifications sent successfully`);
      } catch (e) {
        console.error('[Notify] Notification error:', e);
      }
    });
    console.log(`[Notify] notifyHomeUsers returning immediately (fire-and-forget)`);
  }

  private async notifyUser(userId: string, title: string, body: string): Promise<void> {
    setImmediate(async () => {
      try {
        console.log(`[Notify] Starting notifyUser for user ${userId}`);
        const tokens = await this.apnsModel.find({ userId: new Types.ObjectId(userId), enabled: true }).select('token').exec();
        const tokenValues = tokens.map(t => t.token);
        console.log(`[Notify] Found ${tokenValues.length} tokens for user`);
        if (tokenValues.length === 0) return;
        
        await this.apns.sendToTokens(tokenValues, { title, body }, { userId }, 'alert');
        console.log(`[Notify] User notifications sent successfully`);
      } catch (e) {
        console.error('[Notify] User notification error:', e);
      }
    });
    console.log(`[Notify] notifyUser returning immediately (fire-and-forget)`);
  }
}
