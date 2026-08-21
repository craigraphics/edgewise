/*
 * Same card as Open Graph. Kept as a re-export rather than a second design:
 * Twitter's `summary_large_image` is the same shape, and two files that drift
 * apart is how one network ends up showing last month's wording.
 */
export { alt, size, contentType, default } from './opengraph-image';
