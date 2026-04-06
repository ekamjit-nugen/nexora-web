import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhooksController, IncomingWebhookController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';
import { WebhookSchema } from './schemas/webhook.schema';
import { MessageSchema } from '../messages/schemas/message.schema';
import { ConversationSchema } from '../conversations/schemas/conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Webhook', schema: WebhookSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ]),
  ],
  controllers: [WebhooksController, IncomingWebhookController],
  providers: [WebhooksService, WebhookDeliveryProcessor],
  exports: [WebhooksService, WebhookDeliveryProcessor],
})
export class WebhooksModule {}
