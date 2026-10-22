import { Injectable } from '@nestjs/common';

@Injectable()
export class MerchantNormalizationService {
  normalize(description: string): string {
    const normalized = description
      .normalize('NFKC')
      .toLowerCase()
      // Remove phone numbers commonly appended to card statement descriptors.
      .replace(/\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, ' ')
      // Support domains are metadata; merchant domains retain their name.
      .replace(
        /\b(?:https?:\/\/)?(?:help|support)\.[a-z0-9.-]+\.[a-z]{2,}\b/g,
        ' ',
      )
      .replace(
        /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+)\.(?:com|net|org|io|co)\b/g,
        '$1',
      )
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Uber's ride descriptor is distinct from its food delivery merchant.
    if (/^uber trip(?:\s|$)/.test(normalized)) {
      return 'uber';
    }

    return normalized;
  }
}
