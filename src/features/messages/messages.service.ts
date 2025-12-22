import { Injectable } from '@nestjs/common';
import type { MultipartFile } from '@fastify/multipart';
import { MessagesQueueService } from './messages-queue.service';
import { clearDevice } from 'src/utils/ble';

@Injectable()
export class MessagesService {
  constructor(private readonly queue: MessagesQueueService) {}

  async setImage(deviceId: string, file: MultipartFile): Promise<void> {
    await this.queue.runExclusive(deviceId, 'setImage', async () => {
      await this.sendAndWaitAck(deviceId, 'setImage', { file });
    });
  }

  async clearImage(deviceId: string): Promise<void> {
    await this.queue.runExclusive(deviceId, 'clearImage', async () => {
      await this.sendAndWaitAck(deviceId, 'clearImage');
    });
  }

  async flash(deviceId: string, color: string): Promise<void> {
    await this.queue.runExclusive(deviceId, 'flash', async () => {
      await this.sendAndWaitAck(deviceId, 'flash', { color });
    });
  }

  private async sendAndWaitAck(
    deviceId: string,
    type: 'setImage' | 'clearImage' | 'flash',
    payload?: unknown,
    timeoutMs = 10000,
  ): Promise<void> {
    switch (type) {
        case 'clearImage':
            clearDevice(deviceId);
            return;
        case 'setImage':
        case 'flash':
            // Placeholder for actual implementation
            return;
        default:
            throw new Error(`Unknown message type: ${type}`);
    }
  }
}
