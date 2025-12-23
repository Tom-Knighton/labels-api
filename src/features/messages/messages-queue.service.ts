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

  /**
   * Queue a task to run in background without blocking the HTTP response.
   * The task is queued per-device to maintain ordering, but doesn't await the result.
   */
  queueBackgroundTask<T>(
    deviceId: string,
    type: 'setImage' | 'clearImage' | 'flash',
    task: () => Promise<T>,
  ): void {
    const messageId = `msg_${++this.messageIdCounter}_${Date.now()}`;
    const message: QueuedMessage = {
      id: messageId,
      deviceId,
      type,
      status: 'pending',
      enqueuedAt: new Date(),
    };
    
    this.messages.set(messageId, message);
    console.log(`[Queue] Enqueued ${type} for device ${deviceId} (msg: ${messageId})`);

    const prev = this.queues.get(deviceId);
    console.log(`[Queue] Previous promise exists for device ${deviceId}:`, !!prev);
    
    const executeTask = async () => {
      message.status = 'processing';
      message.startedAt = new Date();
      console.log(`[Queue] Starting ${type} for device ${deviceId}`);
      
      try {
        let timeout = type === 'setImage' ? 180000 : 60000;
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Task timeout after ${timeout / 1000} seconds`)), timeout);
        });
        
        await Promise.race([task(), timeoutPromise]);
        
        message.status = 'completed';
        message.completedAt = new Date();
        console.log(`[Queue] Completed ${type} for device ${deviceId}`);
      } catch (err) {
        message.status = 'failed';
        message.completedAt = new Date();
        message.error = err instanceof Error ? err.message : String(err);
        console.error(`[Queue] Failed ${type} for device ${deviceId}:`, err);
      }
      console.log(`[Queue] executeTask finished for ${type} device ${deviceId}`);
    };
    
    const next = (prev ?? Promise.resolve())
      .then(() => {
        console.log(`[Queue] About to execute ${type} for device ${deviceId}`);
        return executeTask();
      })
      .then(() => {
        console.log(`[Queue] Task ${type} for device ${deviceId} fully resolved`);
      })
      .catch((err) => {
        console.error(`[Queue] Uncaught error in ${type} for device ${deviceId}:`, err);
        return undefined;
      })
      .finally(() => {
        const current = this.queues.get(deviceId);
        console.log(`[Queue] Finally block for ${type} device ${deviceId}, current === next:`, current === next);
        if (current === next) {
          this.queues.delete(deviceId);
          console.log(`[Queue] Cleaned up queue for device ${deviceId}`);
        } else {
          console.log(`[Queue] Queue for device ${deviceId} already has next task`);
        }
      });
    
    this.queues.set(deviceId, next);
    console.log(`[Queue] Stored promise for device ${deviceId}`);
    
    setImmediate(() => {
      console.log(`[Queue] setImmediate triggered for ${type} device ${deviceId}`);
      next.catch(() => {
        // Already handled above
      });
    });
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
