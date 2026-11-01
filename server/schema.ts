import { z } from 'zod';
export const uuid = z.string().uuid();
export const domain = z.enum(['recognition','foundations','investigations','management','safety']);
export const mapping = z.object({ questionId: uuid, topicId: z.string().min(1).max(80), domain }).strict();
export const source = z.object({ title: z.string().min(1).max(500), reference: z.string().min(1).max(2000), retrievedAt: z.string().datetime() }).strict();
export const question = z.object({
  question: z.string().min(1).max(12000), options: z.object({A:z.string().min(1).max(4000),B:z.string().min(1).max(4000),C:z.string().min(1).max(4000),D:z.string().min(1).max(4000),E:z.string().min(1).max(4000)}).strict(),
  answer: z.enum(['A','B','C','D','E']), explanation: z.string().max(8000).default(''), sources: z.array(source).max(20).default([]),
  topicId: z.string().max(80).optional(), domain: domain.optional(), contextualTags: z.array(z.string().max(120)).max(20).default([]),
  learningStage:z.enum(['foundation','focused','clinical']).optional(), difficulty:z.enum(['introductory','standard','challenging']).optional(),
  learningObjective:z.string().trim().min(1).max(600).optional(),
  optionRationales:z.object({A:z.string().min(1).max(1800),B:z.string().min(1).max(1800),C:z.string().min(1).max(1800),D:z.string().min(1).max(1800),E:z.string().min(1).max(1800)}).strict().optional()
}).strict();
export const packInput = z.object({ requestId: uuid, title: z.string().min(1).max(200), mode: z.enum(['diagnostic','remediation','synthesis','imported']), questions: z.array(question).min(1).max(200), answerKey: z.string().regex(/^[A-E]+$/).optional() }).strict();
export const performanceMeasurement=z.object({activeMs:z.number().int().min(0).max(86400000),recallMs:z.number().int().min(0).max(86400000),visits:z.number().int().min(1).max(10000),optionsRevealedAt:z.string().datetime().optional(),confidence:z.enum(['unsure','partial','confident']).optional()}).strict().refine(m=>m.recallMs<=m.activeMs,'Recall time exceeds active time.');
export const eventInput = z.object({ id: uuid, questionId: uuid, selection: z.enum(['A','B','C','D','E']), at: z.string().datetime(),measurement:performanceMeasurement.optional() }).strict();
export const updateInput = z.object({ mutationId: uuid, expectedRevision: z.number().int().nonnegative(), events: z.array(eventInput).max(1000), currentIndex: z.number().int().nonnegative(), complete: z.boolean().default(false) }).strict();
export const reviewInput = z.object({ requestId: uuid, sessionId: uuid, text: z.string().min(1).max(30000), sources: z.array(source).min(1).max(100) }).strict();
export const proposalInput = z.object({ requestId: uuid, packId: uuid, mappings: z.array(mapping).min(1).max(200) }).strict();
