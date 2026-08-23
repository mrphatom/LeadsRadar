import { z } from 'zod';

const boundedText = (max: number) => z.string().trim().min(1).max(max);

export const searchLeadsSchema = z.object({
  country: boundedText(100),
  city: boundedText(100),
  category: boundedText(120),
  platforms: z.array(boundedText(64)).max(8).optional(),
}).strict();

export const enrichLeadSchema = z.object({
  name: boundedText(160),
  city: boundedText(100),
  country: boundedText(100),
  category: z.string().trim().max(120).optional(),
}).strict();

export const linkedinIntelligenceSchema = z.object({
  companyName: boundedText(160),
  city: boundedText(100).optional(),
  country: boundedText(100).optional(),
  category: z.string().trim().max(120).optional(),
}).strict();

export const webAdaptabilitySchema = z.object({
  leadId: z.string().trim().max(160).optional(),
  name: boundedText(160),
  city: boundedText(100).optional(),
  country: boundedText(100).optional(),
  category: z.string().trim().max(120).optional(),
  websiteStatus: z.string().trim().max(500).optional(),
}).strict();

export const aiLeadSchema = z.object({
  id: z.string().trim().max(160).optional(),
  name: boundedText(160),
  country: boundedText(100).optional(),
  city: boundedText(100),
  address: z.string().trim().max(300).optional(),
  category: boundedText(120),
  phone: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(320).optional(),
  websiteStatus: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(3000).optional(),
  status: z.enum(['new', 'contacted', 'proposal', 'negotiating', 'won', 'rejected']).optional(),
});

export const generatePitchSchema = z.object({
  lead: aiLeadSchema,
  variant: z.enum(['direct', 'value-first', 'question-based', 'warm_consultant', 'direct_founder', 'local_neighbor', 'loom_video_script', 'audio_voiceover']).default('direct'),
  language: z.enum(['English', 'German', 'French', 'Spanish', 'Italian']).default('English'),
}).strict();

export const generateAnalysisSchema = z.object({
  lead: aiLeadSchema,
}).strict();

export const chatAssistantSchema = z.object({
  lead: aiLeadSchema,
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: boundedText(4000),
  }).strict()).min(1).max(30),
}).strict();

export const checkoutSessionSchema = z.object({
  period: z.enum(['month', 'year']).default('month'),
}).strict();

export const paystackVerifySchema = z.object({
  reference: boundedText(200),
}).strict();

export const gmailConnectSchema = z.object({
  email: z.string().trim().email().max(320),
  token: boundedText(4096),
}).strict();

export const gmailSendSchema = z.object({
  to: z.string().trim().email().max(320),
  subject: boundedText(500),
  body: boundedText(10000),
}).strict();

export const gmailReplyCheckSchema = z.object({
  leadEmail: z.string().trim().email().max(320),
}).strict();

export type SearchLeadsInput = z.infer<typeof searchLeadsSchema>;
export type EnrichLeadInput = z.infer<typeof enrichLeadSchema>;
export type GeneratePitchInput = z.infer<typeof generatePitchSchema>;
export type ChatAssistantInput = z.infer<typeof chatAssistantSchema>;
