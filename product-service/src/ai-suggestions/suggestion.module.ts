import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuggestionService } from './suggestion.service';
import { SuggestionController } from './suggestion.controller';
import { AISuggestionResultSchema } from './suggestion.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'AISuggestionResult', schema: AISuggestionResultSchema }])],
  providers: [SuggestionService],
  controllers: [SuggestionController],
  exports: [SuggestionService],
})
export class SuggestionModule {}
