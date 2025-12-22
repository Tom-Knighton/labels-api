import { Injectable } from '@nestjs/common';

export interface QueuedMessage {
  id: string;
  deviceId: string;
  type: 'setImage' | 'clearImage' | 'flash';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  enqueuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

@Injectable()
export class MessagesQueueService {
  private queues = new Map<string, Promise<unknown>>();
  private messages = new Map<string, QueuedMessage>();
  private messageIdCounter = 0;

  async runExclusive<T>(
    deviceId: string,
    type: 'setImage' | 'clearImage' | 'flash',
    task: () => Promise<T>,
  ): Promise<T> {
    const messageId = `msg_${++this.messageIdCounter}_${Date.now()}`;
    const message: QueuedMessage = {
      id: messageId,
      deviceId,
      type,
      status: 'pending',
      enqueuedAt: new Date(),
    };
    
    this.messages.set(messageId, message);

    const prev = this.queues.get(deviceId) ?? Promise.resolve();
    const next = prev.then(async () => {
      message.status = 'processing';
      message.startedAt = new Date();
      try {
        const result = await task();
        message.status = 'completed';
        message.completedAt = new Date();
        return result;
      } catch (err) {
        message.status = 'failed';
        message.completedAt = new Date();
        message.error = err instanceof Error ? err.message : String(err);
        throw err;
      }
    });
    
    this.queues.set(deviceId, next.catch(() => {}));
    
    try {
      const result = await next;
      return result;
    } finally {
      const current = this.queues.get(deviceId);
      if (current === next || current === (next as Promise<unknown>).catch(() => {})) {
        this.queues.delete(deviceId);
      }
    }
  }

  getQueuedMessages(deviceId: string): QueuedMessage[] {
    const messages: QueuedMessage[] = [];
    for (const msg of this.messages.values()) {
      if (msg.deviceId === deviceId) {
        messages.push(msg);
      }
    }
    return messages.sort((a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime());
  }

  cleanupCompletedMessages(olderThanMs = 60000): void {
    const cutoff = Date.now() - olderThanMs;
    for (const [id, msg] of this.messages.entries()) {
      if (
        (msg.status === 'completed' || msg.status === 'failed') &&
        msg.completedAt &&
        msg.completedAt.getTime() < cutoff
      ) {
        this.messages.delete(id);
      }
    }
  }
}
