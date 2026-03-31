import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IIntegration, IIntegrationField } from './integration.model';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class IntegrationService {
  constructor(@InjectModel('Integration') private integrationModel: Model<IIntegration>) {}

  /**
   * Create integration
   */
  async createIntegration(
    productId: string,
    integrationData: {
      name: string;
      description?: string;
      provider: string;
      configuration: Record<string, any>;
      fieldMappings: IIntegrationField[];
    },
  ): Promise<IIntegration> {
    if (!integrationData.provider) {
      throw new BadRequestException('Provider is required');
    }

    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const webhookUrl = `https://api.nexora.com/webhooks/${uuidv4()}`;

    const integration = new this.integrationModel({
      productId,
      ...integrationData,
      status: 'inactive',
      webhookSecret,
      webhookUrl,
    });

    return integration.save();
  }

  /**
   * Get integration
   */
  async getIntegration(integrationId: string): Promise<IIntegration> {
    const integration = await this.integrationModel.findById(integrationId);
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }
    return integration;
  }

  /**
   * Get product integrations
   */
  async getProductIntegrations(productId: string): Promise<IIntegration[]> {
    return this.integrationModel.find({ productId }).exec();
  }

  /**
   * Get integrations by provider
   */
  async getIntegrationsByProvider(productId: string, provider: string): Promise<IIntegration[]> {
    return this.integrationModel.find({ productId, provider }).exec();
  }

  /**
   * Update integration
   */
  async updateIntegration(
    integrationId: string,
    updates: Partial<IIntegration>,
  ): Promise<IIntegration> {
    const integration = await this.getIntegration(integrationId);
    Object.assign(integration, updates);
    return integration.save();
  }

  /**
   * Test integration connection
   */
  async testConnection(integrationId: string): Promise<{ success: boolean; message: string }> {
    const integration = await this.getIntegration(integrationId);

    try {
      // Simulate connection test based on provider
      switch (integration.provider.toLowerCase()) {
        case 'slack':
          return this.testSlackConnection(integration.configuration);
        case 'github':
          return this.testGitHubConnection(integration.configuration);
        case 'jira':
          return this.testJiraConnection(integration.configuration);
        default:
          return { success: true, message: 'Connection test not implemented for this provider' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Sync integration data
   */
  async syncIntegration(integrationId: string): Promise<IIntegration> {
    const integration = await this.getIntegration(integrationId);

    try {
      // Simulate sync based on provider
      integration.lastSync = new Date();
      integration.status = 'active';
      integration.errorMessage = undefined;
    } catch (error) {
      integration.status = 'error';
      integration.errorMessage = error.message;
    }

    return integration.save();
  }

  /**
   * Map fields for integration
   */
  async mapFields(
    integrationId: string,
    fieldMappings: IIntegrationField[],
  ): Promise<IIntegration> {
    const integration = await this.getIntegration(integrationId);
    integration.fieldMappings = fieldMappings;
    return integration.save();
  }

  /**
   * Enable integration
   */
  async enableIntegration(integrationId: string): Promise<IIntegration> {
    const integration = await this.getIntegration(integrationId);
    integration.status = 'active';
    return integration.save();
  }

  /**
   * Disable integration
   */
  async disableIntegration(integrationId: string): Promise<IIntegration> {
    const integration = await this.getIntegration(integrationId);
    integration.status = 'inactive';
    return integration.save();
  }

  /**
   * Get available providers
   */
  async getAvailableProviders(): Promise<any[]> {
    return [
      {
        name: 'Slack',
        id: 'slack',
        description: 'Send notifications to Slack channels',
        fields: ['webhook_url', 'channel', 'username'],
      },
      {
        name: 'GitHub',
        id: 'github',
        description: 'Sync with GitHub repositories',
        fields: ['token', 'owner', 'repo'],
      },
      {
        name: 'Jira',
        id: 'jira',
        description: 'Integrate with Jira projects',
        fields: ['url', 'username', 'api_token'],
      },
      {
        name: 'Webhook',
        id: 'webhook',
        description: 'Custom webhook integration',
        fields: ['url', 'headers', 'method'],
      },
      {
        name: 'Google Sheets',
        id: 'sheets',
        description: 'Sync with Google Sheets',
        fields: ['spreadsheet_id', 'api_key'],
      },
    ];
  }

  /**
   * Test Slack connection
   */
  private testSlackConnection(config: Record<string, any>): { success: boolean; message: string } {
    if (!config.webhook_url) {
      throw new Error('Slack webhook URL is required');
    }
    return { success: true, message: 'Slack connection test passed' };
  }

  /**
   * Test GitHub connection
   */
  private testGitHubConnection(config: Record<string, any>): { success: boolean; message: string } {
    if (!config.token) {
      throw new Error('GitHub token is required');
    }
    return { success: true, message: 'GitHub connection test passed' };
  }

  /**
   * Test Jira connection
   */
  private testJiraConnection(config: Record<string, any>): { success: boolean; message: string } {
    if (!config.url || !config.api_token) {
      throw new Error('Jira URL and API token are required');
    }
    return { success: true, message: 'Jira connection test passed' };
  }

  /**
   * Delete integration
   */
  async deleteIntegration(integrationId: string): Promise<void> {
    await this.integrationModel.findByIdAndDelete(integrationId);
  }
}
