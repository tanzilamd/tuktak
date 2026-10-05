export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  education: string;
  institution: string | null;
  class_year: string;
  ssc_batch: string;
  hsc_batch: string;
  hobbies: string[];
  status: string;
  accent: string;
  discoverable: boolean;
  created_at: string;
};
export type PostStats = {
  reaction_counts: Record<string, number>;
  current_reaction: string | null;
  comment_count: number;
  poll?: Poll | null;
  quote?: QuotePreview | null;
  mentions?: string[];
};
export type Poll = {
  expires_at: string;
  selected_option: string | null;
  options: { id: string; body: string; votes: number }[];
};
export type QuotePreview = {
  id: string;
  body: string;
  created_at: string;
  profiles: Pick<
    Profile,
    "id" | "username" | "display_name" | "accent" | "status"
  >;
  has_poll: boolean;
};
export type Post = PostStats & {
  id: string;
  author_id: string;
  body: string;
  mood: string | null;
  created_at: string;
  updated_at?: string | null;
  is_quote?: boolean;
  quoted_post_id?: string | null;
  profiles: Profile;
};
export type Comment = {
  id: string;
  post_id: string;
  parent_id?: string | null;
  reply_count?: number;
  mentions?: string[];
  author_id: string;
  body: string;
  created_at: string;
  profiles: QuotePreview["profiles"];
};
export type Viewer = {
  id: string;
  profile: Profile;
  role: "user" | "moderator" | "admin";
  suspended: boolean;
};
export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  unreadCount?: number;
};

export type FeedMode = "all" | "following" | "institution";
export type FollowCounts = { followers: number; following: number };
export type SocialResult = ActionState & {
  id?: string;
  post?: Post;
  stats?: PostStats | null;
  comments?: Comment[];
  following?: boolean;
  counts?: FollowCounts;
  batchStats?: Record<string, PostStats>;
  uncertain?: boolean;
};
