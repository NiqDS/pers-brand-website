export type PostKind = 'digest' | 'article' | 'note';
export type PostStatus = 'draft' | 'published';
export type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed';
export type DeliveryChannel = 'email' | 'substack' | 'linkedin';
export type DeliveryStatus = 'sent' | 'failed' | 'skipped';
export type ArcStatus = 'draft' | 'published';
export type Movement = 'tue' | 'thu' | 'fri-li' | 'fri-sub' | 'brief';

export interface Post {
  id: number;
  slug: string;
  kind: PostKind;
  title: string;
  body_md: string;
  theme: string | null;
  status: PostStatus;
  created_at: string;
  published_at: string | null;
}

export interface Subscriber {
  id: number;
  email: string;
  status: SubscriberStatus;
  confirm_token: string;
  created_at: string;
  confirmed_at: string | null;
}

export interface Delivery {
  id: number;
  post_id: number;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  detail: string | null;
  created_at: string;
}

export interface Arc {
  id: number;
  week_number: number;
  topic: string;
  thesis: string;
  source_notes: string;
  tease: string;
  status: ArcStatus;
  post_id: number | null;
  created_at: string;
  published_at: string | null;
}

export interface Draft {
  id: number;
  arc_id: number;
  movement: Movement;
  body_md: string;
  word_count: number;
  created_at: string;
}
