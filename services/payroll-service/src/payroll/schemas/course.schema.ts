import { Schema, Document } from 'mongoose';

export interface ICourseResource {
  title: string;
  url: string;
  type: string;
}

export interface ICourseLesson {
  id: string;
  title: string;
  type: string;
  content?: string;
  videoUrl?: string;
  duration: number;
  order: number;
  isRequired: boolean;
  resources: ICourseResource[];
}

export interface ICourseQuizQuestion {
  id: string;
  question: string;
  type: string;
  options: string[];
  correctAnswer: any;
  points: number;
  explanation?: string;
}

export interface ICourseQuiz {
  passingScore: number;
  questions: ICourseQuizQuestion[];
}

export interface ICourseStats {
  totalEnrolled: number;
  totalCompleted: number;
  avgRating: number;
  ratingCount: number;
  avgCompletionDays: number;
}

export interface ICourse extends Document {
  organizationId: string;
  title: string;
  description: string;
  thumbnail?: string;
  category: string;
  level: string;
  duration: number;
  instructor?: string;
  tags: string[];
  lessons: ICourseLesson[];
  quiz?: ICourseQuiz;
  certificateTemplate?: string;
  prerequisites: string[];
  skillsGained: string[];
  targetAudience: string;
  departments: string[];
  designations: string[];
  employeeIds: string[];
  isMandatory: boolean;
  dueInDays?: number;
  status: string;
  stats: ICourseStats;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CourseSchema = new Schema<ICourse>(
  {
    organizationId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    thumbnail: { type: String, default: null },
    category: {
      type: String,
      enum: [
        'technical',
        'soft_skills',
        'compliance',
        'leadership',
        'onboarding',
        'product',
        'sales',
        'customer_service',
        'other',
      ],
      required: true,
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'all'],
      default: 'all',
    },
    duration: { type: Number, default: 0 },
    instructor: { type: String, default: null },
    tags: { type: [String], default: [] },
    lessons: [
      {
        id: { type: String, required: true },
        title: { type: String, required: true },
        type: {
          type: String,
          enum: ['video', 'article', 'quiz', 'assignment', 'live_session', 'document'],
          required: true,
        },
        content: { type: String, default: null },
        videoUrl: { type: String, default: null },
        duration: { type: Number, default: 0 },
        order: { type: Number, default: 0 },
        isRequired: { type: Boolean, default: true },
        resources: [
          {
            title: { type: String, required: true },
            url: { type: String, required: true },
            type: { type: String, required: true },
          },
        ],
      },
    ],
    quiz: {
      type: {
        passingScore: { type: Number, default: 70 },
        questions: [
          {
            id: { type: String, required: true },
            question: { type: String, required: true },
            type: {
              type: String,
              enum: ['single_choice', 'multi_choice', 'true_false'],
              required: true,
            },
            options: { type: [String], default: [] },
            correctAnswer: { type: Schema.Types.Mixed, required: true },
            points: { type: Number, default: 1 },
            explanation: { type: String, default: null },
          },
        ],
      },
      default: null,
    },
    certificateTemplate: { type: String, default: null },
    prerequisites: { type: [String], default: [] },
    skillsGained: { type: [String], default: [] },
    targetAudience: {
      type: String,
      enum: ['all', 'department', 'designation', 'specific'],
      default: 'all',
    },
    departments: { type: [String], default: [] },
    designations: { type: [String], default: [] },
    employeeIds: { type: [String], default: [] },
    isMandatory: { type: Boolean, default: false },
    dueInDays: { type: Number, default: null },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    stats: {
      totalEnrolled: { type: Number, default: 0 },
      totalCompleted: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 },
      avgCompletionDays: { type: Number, default: 0 },
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

CourseSchema.index({ organizationId: 1, status: 1, category: 1 });
CourseSchema.index({ organizationId: 1, isMandatory: 1 });
CourseSchema.index({ isDeleted: 1 });
