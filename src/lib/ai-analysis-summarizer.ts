/**
 * Summarizes AI fraud analysis explanations to be more informative while remaining concise
 * Preserves key fraud indicators and specific reasoning
 * @param explanation - The full AI explanation text
 * @returns A summarized version with key details (3-5 sentences)
 */
export function summarizeAIAnalysis(explanation: string): string {
  if (!explanation || explanation.trim().length === 0) {
    return 'No analysis available.';
  }

  // Remove common prefixes that add no value
  let cleaned = explanation
    .replace(/^AI Analysis:\s*/i, '')
    .replace(/^Analysis:\s*/i, '')
    .trim();

  // If already short (under 400 chars), return as-is
  if (cleaned.length <= 400) {
    return cleaned;
  }

  // Split into sentences
  const sentences = cleaned
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15); // Filter out very short fragments

  if (sentences.length === 0) {
    return cleaned.substring(0, 400) + (cleaned.length > 400 ? '...' : '');
  }

  // Keywords that indicate important fraud-related information
  const fraudKeywords = [
    'duplicate', 'excessive', 'unreasonable', 'unusual', 'suspicious', 'concerning',
    'irregular', 'anomaly', 'discrepancy', 'mismatch', 'inconsistent', 'fraud',
    'fraudulent', 'flag', 'flagged', 'warning', 'alert', 'concern', 'risk',
    'total', 'amount', 'vendor', 'date', 'item', 'price', 'tax', 'tip',
    'location', 'time', 'category', 'personal', 'blurry', 'modified', 'altered'
  ];

  // Score sentences by importance (fraud indicators, specific details, etc.)
  const scoredSentences = sentences.map((sentence, index) => {
    const lower = sentence.toLowerCase();
    let score = 0;
    
    // First sentence usually contains summary - give it priority
    if (index === 0) score += 10;
    
    // Sentences with fraud keywords are important
    fraudKeywords.forEach(keyword => {
      if (lower.includes(keyword)) {
        score += 5;
      }
    });
    
    // Sentences with numbers (amounts, dates, percentages) are important
    if (/\d+/.test(sentence)) {
      score += 3;
    }
    
    // Sentences with specific reasons (because, due to, reason, cause)
    if (/\b(because|due to|reason|cause|indicates?|suggests?|shows?|demonstrates?)\b/i.test(sentence)) {
      score += 4;
    }
    
    // Sentences explaining why (why, how, what)
    if (/\b(why|how|what|which|where|when)\b/i.test(sentence)) {
      score += 2;
    }
    
    // Shorter sentences are often clearer
    if (sentence.length < 120) {
      score += 1;
    }
    
    return { sentence, score, index };
  });

  // Sort by score (highest first) and take top sentences
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 5) // Take top 5 sentences
    .sort((a, b) => a.index - b.index); // Re-sort by original order

  // Build summary from top sentences
  let summary = topSentences.map(s => s.sentence).join('. ');

  // Ensure we have at least the first sentence
  if (!summary.includes(sentences[0])) {
    summary = sentences[0] + '. ' + summary;
  }

  // Clean up: remove duplicate sentences
  const uniqueSentences = summary.split('. ').filter((s, i, arr) => {
    const normalized = s.toLowerCase().trim();
    return arr.findIndex(a => a.toLowerCase().trim() === normalized) === i;
  });
  summary = uniqueSentences.join('. ');

  // Ensure proper ending
  if (!summary.endsWith('.') && !summary.endsWith('!') && !summary.endsWith('?')) {
    summary += '.';
  }

  // Limit total length to ~600 characters (more than before to include details)
  if (summary.length > 600) {
    // Try to truncate at a sentence boundary
    const truncated = summary.substring(0, 597);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > 400) {
      summary = truncated.substring(0, lastPeriod + 1);
    } else {
      summary = truncated + '...';
    }
  }

  return summary.trim();
}

/**
 * Gets a short status summary (1 sentence) for quick display
 * @param explanation - The full AI explanation text
 * @param fraudProbability - The fraud probability (0-1)
 * @returns A one-sentence summary
 */
export function getAIStatusSummary(explanation: string, fraudProbability: number): string {
  if (!explanation || explanation.trim().length === 0) {
    return fraudProbability > 0.5 
      ? 'Analysis indicates potential concerns.' 
      : 'Analysis shows no significant issues.';
  }

  const cleaned = explanation
    .replace(/^AI Analysis:\s*/i, '')
    .replace(/^Analysis:\s*/i, '')
    .trim();

  // Extract first meaningful sentence
  const sentences = cleaned
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15);

  if (sentences.length === 0) {
    return fraudProbability > 0.5 
      ? 'Analysis indicates potential concerns.' 
      : 'Analysis shows no significant issues.';
  }

  let firstSentence = sentences[0];

  // Truncate if too long
  if (firstSentence.length > 120) {
    firstSentence = firstSentence.substring(0, 117).trim() + '...';
  }

  return firstSentence;
}

