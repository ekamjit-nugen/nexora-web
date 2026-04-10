import { Schema, Document } from 'mongoose';

export interface ISurveyAnswer {
  questionId: string;
  answer: any;
}

export interface ISurveyResponse extends Document {
  organizationId: string;
  surveyId: string;
  employeeId?: string;
  answers: ISurveyAnswer[];
  comment?: string;
  submittedAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const SurveyResponseSchema = new Schema<ISurveyResponse>(
  {
    organizationId: { type: String, required: true, index: true },
    surveyId: { type: String, required: true, index: true },
    employeeId: { type: String, default: null },
    answers: [
      {
        questionId: { type: String, required: true },
        answer: { type: Schema.Types.Mixed },
      },
    ],
    comment: { type: String, default: null },
    submittedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

SurveyResponseSchema.index(
  { organizationId: 1, surveyId: 1, employeeId: 1 },
  { unique: true, partialFilterExpression: { employeeId: { $type: 'string' } } },
);
SurveyResponseSchema.index({ surveyId: 1 });
