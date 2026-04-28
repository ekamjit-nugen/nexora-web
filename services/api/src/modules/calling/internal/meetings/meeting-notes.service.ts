import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMeeting } from './schemas/meeting.schema';

/**
 * E3 10.1: AI Meeting Notes Generator.
 * After meeting ends, generates structured notes from transcript.
 * Auto-posts to meeting chat.
 */
@Injectable()
export class MeetingNotesService {
  private readonly logger = new Logger(MeetingNotesService.name);
  private readonly llmUrl = process.env.LLM_BASE_URL || 'http://host.docker.internal:11434/v1/chat/completions';
  private readonly model = process.env.LLM_MODEL || 'deepseek';

  constructor(
    @InjectModel('Meeting', 'nexora_calling') private meetingModel: Model<IMeeting>,
  ) {}

  async generateMeetingNotes(meetingId: string): Promise<string> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const transcript = meeting.transcript || [];
    if (transcript.length === 0) return 'No transcript available for this meeting.';

    const transcriptText = transcript.map(t =>
      `${t.speakerName}: ${t.text}`
    ).join('\n');

    const participants = meeting.participants
      .filter(p => p.joinedAt)
      .map(p => p.displayName)
      .join(', ');

    try {
      const axios = (await (Function('return import("axios")')())).default;
      const res = await axios.post(this.llmUrl, {
        model: this.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `You are a meeting notes generator. Given a meeting transcript, create structured notes in markdown format:

## Meeting Notes: {title} — {date}

### Attendees
List of attendees

### Key Decisions
Numbered list of decisions made

### Action Items
- [ ] Person: Action item with deadline if mentioned

### Follow-up Topics
Topics that need separate discussion

Keep it concise and professional. Under 500 words.`,
          },
          {
            role: 'user',
            content: `Meeting: ${meeting.title}\nDate: ${meeting.startedAt?.toISOString().split('T')[0] || 'Unknown'}\nAttendees: ${participants}\n\nTranscript:\n${transcriptText}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }, { timeout: 60000 });

      const notes = res.data?.choices?.[0]?.message?.content?.trim() || 'Unable to generate notes.';
      this.logger.log(`Meeting notes generated for ${meetingId} (${notes.length} chars)`);
      return notes;
    } catch (err) {
      this.logger.warn(`Meeting notes generation failed: ${err.message}`);
      return 'Meeting notes generation temporarily unavailable.';
    }
  }
}
