import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ElasticsearchProvider } from './elasticsearch.provider';
import { SEARCH_PROVIDER } from './search-provider.interface';
import { MessageSchema } from '../messages/schemas/message.schema';
import { ConversationSchema } from '../conversations/schemas/conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Message', schema: MessageSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ], "nexora_chat"),
  ],
  controllers: [SearchController],
  providers: [
    SearchService,
    {
      provide: SEARCH_PROVIDER,
      useFactory: (mongoSearch: SearchService) => {
        if (process.env.ELASTICSEARCH_URL) {
          return new ElasticsearchProvider(mongoSearch);
        }
        return mongoSearch;
      },
      inject: [SearchService],
    },
  ],
  exports: [SearchService, SEARCH_PROVIDER],
})
export class SearchModule {}
