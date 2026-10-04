import type { Post } from "./types";
/** One mounted feed/session only. No module-global or persistent user data. */
export class FeedCache {
  private entries = new Map<string, { posts: Post[]; at: number }>();
  private requests = new Map<string, Promise<Post[] | null>>();
  private generation = 0;
  constructor(private now = () => Date.now()) {}
  seed(key: string, posts: Post[]) {
    this.entries.set(key, { posts, at: this.now() });
    if (this.entries.size > 8)
      this.entries.delete(this.entries.keys().next().value!);
  }
  peek(key: string) {
    const entry = this.entries.get(key);
    return entry && this.now() - entry.at < 5000 ? entry.posts : undefined;
  }
  clear() {
    this.generation++;
    this.entries.clear();
    this.requests.clear();
  }
  load(key: string, read: () => Promise<Post[]>): Promise<Post[] | null> {
    const cached = this.peek(key);
    if (cached) return Promise.resolve(cached);
    const existing = this.requests.get(key);
    if (existing) return existing;
    const generation = this.generation;
    const request = read()
      .then((posts) => {
        if (generation !== this.generation) return null;
        this.seed(key, posts);
        return posts;
      })
      .finally(() => {
        if (this.requests.get(key) === request) this.requests.delete(key);
      });
    this.requests.set(key, request);
    return request;
  }
}
