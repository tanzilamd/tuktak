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
export type Post = {
  reaction_counts?: Record<string, number>;
  current_reaction?: string | null;
  comment_count?: number;
  id: string;
  author_id: string;
  body: string;
  mood: string | null;
  created_at: string;
  profiles: Profile;
  reactions: { user_id: string; kind: string }[];
  comments: { id: string }[];
};
export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: Profile;
};
export type Viewer = {
  id: string;
  profile: Profile;
  role: "user" | "moderator" | "admin";
  suspended: boolean;
};
export type ActionState = { ok: boolean; message: string };
