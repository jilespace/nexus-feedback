import { prisma } from '../db/client.js';
import { NotFoundError } from '../utils/errors.js';

/** Minimum score a candidate needs to show up as a merge suggestion. */
export const SIMILARITY_THRESHOLD = 0.2;
/** How many suggestions the merge dialog receives. */
export const SIMILARITY_LIMIT = 5;
/** Newest candidates scanned per project — keeps the endpoint cheap on big projects. */
export const SIMILARITY_CANDIDATE_LIMIT = 500;

export type SimilarityInput = {
  title: string;
  content?: string | null;
  category?: string | null;
  tags?: string[];
};

export type SimilarityCandidate = SimilarityInput & {
  id: string;
  status: string;
  merged_into_id?: string | null;
  deleted_at?: Date | string | null;
};

export type SimilarityMatch = {
  id: string;
  title: string;
  status: string;
  category: string;
  score: number;
};

/** How many merged sources the merge dialog lists. */
export const MERGED_SOURCES_LIMIT = 10;

export type MergedSource = {
  id: string;
  title: string;
  status: string;
  created_at: Date;
};

/** Feedback items that were merged into `feedbackId`, most recent first. */
export async function findMergedSources(feedbackId: string): Promise<MergedSource[]> {
  return prisma.feedback.findMany({
    where: { merged_into_id: feedbackId, deleted_at: null },
    orderBy: { created_at: 'desc' },
    take: MERGED_SOURCES_LIMIT,
    select: { id: true, title: true, status: true, created_at: true },
  });
}

const CJK_RUN = /[\u3400-\u9fff\uf900-\ufaff]+/g;
const LATIN_WORD = /[a-z0-9]+/g;
const NON_SIGNAL = /[^\u3400-\u9fff\uf900-\ufaffa-z0-9]+/g;

function cjkBigrams(run: string): string[] {
  const chars = [...run];
  if (chars.length <= 1) return chars.length === 1 ? chars : [];
  const grams: string[] = [];
  for (let i = 0; i < chars.length - 1; i += 1) {
    grams.push(`${chars[i]}${chars[i + 1]}`);
  }
  return grams;
}

/**
 * Title tokens: latin words (lowercased) plus overlapping 2-grams for every CJK run.
 * Single CJK characters and single latin words are kept as tokens too.
 */
export function titleTokens(title: string): Set<string> {
  const tokens = new Set<string>();
  const lower = title.toLowerCase();
  for (const word of lower.match(LATIN_WORD) ?? []) tokens.add(word);
  for (const run of title.match(CJK_RUN) ?? []) {
    for (const gram of cjkBigrams(run)) tokens.add(gram);
  }
  return tokens;
}

/** Character 2-grams for the content body; whitespace/punctuation are ignored. */
export function contentBigrams(content: string): Set<string> {
  const compact = content.toLowerCase().replace(NON_SIGNAL, '');
  return new Set(cjkBigrams(compact));
}

function overlap(a: Set<string>, b: Set<string>): { jaccard: number; containment: number } {
  if (a.size === 0 || b.size === 0) return { jaccard: 0, containment: 0 };
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return {
    jaccard: union > 0 ? intersection / union : 0,
    containment: intersection / Math.min(a.size, b.size),
  };
}

function sameTagRatio(a: string[] = [], b: string[] = []): number {
  const left = new Set(a.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  const right = new Set(b.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  return overlap(left, right).jaccard;
}

/**
 * Pure similarity score in [0, 1]:
 * title tokens (Jaccard + containment) 55%, content 2-grams 30%,
 * same-category bonus 10%, shared-tag bonus 5%.
 */
export function scoreSimilarity(a: SimilarityInput, b: SimilarityInput): number {
  const title = overlap(titleTokens(a.title), titleTokens(b.title));
  const titleScore = title.jaccard * 0.65 + title.containment * 0.35;
  const contentScore = overlap(contentBigrams(a.content ?? ''), contentBigrams(b.content ?? '')).jaccard;
  const categoryScore = a.category && b.category && a.category === b.category ? 1 : 0;
  const score =
    titleScore * 0.55 + contentScore * 0.3 + categoryScore * 0.1 + sameTagRatio(a.tags, b.tags) * 0.05;
  return Math.round(Math.min(1, score) * 10000) / 10000;
}

/** Scores and ranks candidates, dropping merged/deleted rows, low scores and everything past the limit. */
export function rankSimilarFeedback(
  source: SimilarityInput,
  candidates: SimilarityCandidate[],
): SimilarityMatch[] {
  return candidates
    .filter((candidate) => !candidate.merged_into_id && !candidate.deleted_at)
    .map((candidate) => ({ candidate, score: scoreSimilarity(source, candidate) }))
    .filter((entry) => entry.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, SIMILARITY_LIMIT)
    .map(({ candidate, score }) => ({
      id: candidate.id,
      title: candidate.title,
      status: candidate.status,
      category: candidate.category ?? '',
      score,
    }));
}

const candidateSelect = {
  id: true,
  title: true,
  content: true,
  category: true,
  status: true,
  merged_into_id: true,
  deleted_at: true,
  feedbackTags: { select: { tag: { select: { name: true } } } },
} as const;

function tagNames(rows: Array<{ tag: { name: string } }> | undefined): string[] {
  return (rows ?? []).map((row) => row.tag.name);
}

/** Suggestions for the merge dialog: same project, not deleted, not merged, not the source itself. */
export async function findSimilarFeedback(feedbackId: string, orgId: string) {
  const source = await prisma.feedback.findFirst({
    where: { id: feedbackId, deleted_at: null },
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
      project_id: true,
      feedbackTags: { select: { tag: { select: { name: true } } } },
    },
  });
  if (!source) throw new NotFoundError('反馈不存在');

  const project = await prisma.project.findFirst({
    where: { id: source.project_id, org_id: orgId },
    select: { id: true },
  });
  if (!project) throw new NotFoundError('反馈不存在');

  const candidates = await prisma.feedback.findMany({
    where: {
      project_id: source.project_id,
      deleted_at: null,
      merged_into_id: null,
      id: { not: feedbackId },
    },
    orderBy: { created_at: 'desc' },
    take: SIMILARITY_CANDIDATE_LIMIT,
    select: candidateSelect,
  });

  const items = rankSimilarFeedback(
    {
      title: source.title,
      content: source.content,
      category: source.category,
      tags: tagNames(source.feedbackTags),
    },
    candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      content: candidate.content,
      category: candidate.category,
      status: candidate.status,
      merged_into_id: candidate.merged_into_id,
      deleted_at: candidate.deleted_at,
      tags: tagNames(candidate.feedbackTags),
    })),
  );

  return { items };
}
