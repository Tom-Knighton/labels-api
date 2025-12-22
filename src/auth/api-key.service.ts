import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiKey, ApiKeyDocument } from './api-key.schema';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKeyDocument>,
  ) {}

  async isValidApiKey(key: string): Promise<boolean> {
    const doc = await this.apiKeyModel
      .findOne({ key, active: true })
      .select({ _id: 1 })
      .lean()
      .exec();

    return doc != null;
  }

  async getActiveApiKey(key: string): Promise<ApiKeyDocument | null> {
    return this.apiKeyModel.findOne({ key, active: true }).exec();
  }

  async getUserIdByKey(key: string): Promise<string | null> {
    const doc = await this.apiKeyModel
      .findOne({ key, active: true })
      .select({ userId: 1 })
      .lean()
      .exec();
    return doc ? doc.userId : null;
  }
}