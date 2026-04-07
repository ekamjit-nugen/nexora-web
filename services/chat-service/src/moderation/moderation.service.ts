import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly llmUrl = process.env.LLM_BASE_URL || 'http://host.docker.internal:7/v1/chat/completions';
  private readonly model = process.env.LLM_MODEL || 'deepseek';

  // Quick word check for instant flagging (before AI check)
  private readonly instantFlagWords = [
    // English
    'kill', 'threat', 'bomb', 'attack',
    // Hindi/Punjabi abuses (transliterated)
    'lodu', 'laude', 'chutiya', 'chutiye', 'madarchod', 'behenchod', 'bhosdike', 'bsdk',
    'gandu', 'gaandu', 'penchod', 'kamini', 'haramkhor', 'harami', 'randi', 'raand',
    'kutte', 'kutta', 'bakchod', 'bewakoof', 'gadha', 'ullu', 'saala', 'saale',
    // Shortened/coded forms
    'mc', 'bc', 'mkc', 'bkl',
    // English profanity
    'fuck', 'shit', 'ass', 'bitch', 'bastard', 'dick', 'pussy',
  ];

  async checkMessage(content: string, senderId: string): Promise<{ flagged: boolean; reason?: string; severity?: string }> {
    // Skip very short messages
    if (content.length < 5) return { flagged: false };

    // Instant check for critical words
    // M-005: Use word-boundary regex to avoid false positives (e.g. "class" matching "ass")
    const lower = content.toLowerCase();
    for (const word of this.instantFlagWords) {
      const regex = new RegExp('\\b' + word + '\\b', 'i');
      if (regex.test(lower)) {
        return { flagged: true, reason: `Contains critical word: "${word}"`, severity: 'critical' };
      }
    }

    // AI check — async, non-blocking
    try {
      return await this.aiCheck(content);
    } catch (err) {
      this.logger.warn(`AI moderation check failed: ${err.message}`);
      return { flagged: false }; // Don't block messages if AI is down
    }
  }

  private async aiCheck(content: string): Promise<{ flagged: boolean; reason?: string; severity?: string }> {
    const res = await axios.post(this.llmUrl, {
      model: this.model,
      stream: false,
      messages: [
        {
          role: 'system',
          content: `You are a strict workplace content moderation AI. Your job is to detect ANY inappropriate, offensive, vulgar, or obscene content in messages.

You MUST detect inappropriate content in ALL languages including but not limited to:
- Hindi abuses: gaali, mc, bc, chutiya, bhosdike, madarchod, behenchod, gandu, laude, lodu, etc.
- Punjabi abuses: kida lodu, penchod, kutte, kamini, haramkhor, etc.
- Tamil, Telugu, Bengali, Marathi, Gujarati and other Indian language abuses
- English slang, profanity, f-words, n-words, etc.
- Transliterated abuses written in English/Roman script (like "lodu", "chutiya", "bc")
- ANY regional slang or coded language meant to abuse or offend

Categories to flag:
- Abusive language, profanity, vulgar words (severity: warning)
- Hate speech, discrimination, racism, sexism, casteism (severity: critical)
- Threats, violence, harassment, bullying (severity: critical)
- Sexual content, obscenity (severity: warning)
- Personal attacks, insults (severity: warning)
- Passive-aggressive or coded workplace harassment (severity: info)

Respond with ONLY valid JSON, no markdown, no explanation:
{"flagged": true, "reason": "brief reason", "severity": "info|warning|critical"}
or
{"flagged": false}`
        },
        { role: 'user', content: `Is this message inappropriate? Reply JSON only. Message: "${content}"` }
      ],
      temperature: 0.0,
      max_tokens: 300,
    }, { timeout: 30000 });

    const text = res.data?.choices?.[0]?.message?.content || '';
    this.logger.debug(`AI moderation response: ${text}`);
    try {
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleaned);
      if (result.flagged) {
        this.logger.warn(`AI flagged message: "${content.slice(0, 50)}..." reason: ${result.reason}`);
      }
      return result;
    } catch {
      this.logger.warn(`AI moderation returned unparseable response: ${text.slice(0, 100)}`);
      return { flagged: false };
    }
  }
}
