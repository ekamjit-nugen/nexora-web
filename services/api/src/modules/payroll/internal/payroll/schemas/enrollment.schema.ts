import { Schema, Document } from 'mongoose';

export interface ILessonProgress {
  lessonId: string;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  timeSpent: number;
}

export interface IQuizAttemptAnswer {
  questionId: string;
  answer: any;
  isCorrect: boolean;
}

export interface IQuizAttempt {
  attemptNumber: number;
  score: number;
  passed: boolean;
  answers: IQuizAttemptAnswer[];
  startedAt: Date;
  completedAt: Date;
}

export interface IEnrollment extends Document {
  organizationId: string;
  courseId: string;
  employeeId: string;
  status: string;
  enrolledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  dueDate?: Date;
  progress: number;
  currentLessonId?: string;
  lessonProgress: ILessonProgress[];
  quizAttempts: IQuizAttempt[];
  certificateId?: string;
  certificateUrl?: string;
  rating?: number;
  feedback?: string;
  notes: string[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const EnrollmentSchema = new Schema<IEnrollment>(
  {
    organizationId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['enrolled', 'in_progress', 'completed', 'dropped', 'expired', 'overdue'],
      default: 'enrolled',
    },
    enrolledAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    progress: { type: Number, default: 0 },
    currentLessonId: { type: String, default: null },
    lessonProgress: [
      {
        lessonId: { type: String, required: true },
        status: {
          type: String,
          enum: ['not_started', 'in_progress', 'completed'],
          default: 'not_started',
        },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        timeSpent: { type: Number, default: 0 },
      },
    ],
    quizAttempts: [
      {
        attemptNumber: { type: Number, required: true },
        score: { type: Number, required: true },
        passed: { type: Boolean, required: true },
        answers: [
          {
            questionId: { type: String, required: true },
            answer: { type: Schema.Types.Mixed },
            isCorrect: { type: Boolean, default: false },
          },
        ],
        startedAt: { type: Date, required: true },
        completedAt: { type: Date, required: true },
      },
    ],
    certificateId: { type: String, default: null },
    certificateUrl: { type: String, default: null },
    rating: { type: Number, default: null },
    feedback: { type: String, default: null },
    notes: { type: [String], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

EnrollmentSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
EnrollmentSchema.index({ organizationId: 1, courseId: 1, status: 1 });
EnrollmentSchema.index(
  { organizationId: 1, courseId: 1, employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  },
);
EnrollmentSchema.index({ isDeleted: 1 });
