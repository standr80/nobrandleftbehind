// Convenience type aliases over the Supabase generated types.
// Import these instead of the raw Database type in application code.
import type { Tables, TablesInsert, TablesUpdate } from './types'

export type Tenant = Tables<'tenants'>
export type TenantInsert = TablesInsert<'tenants'>
export type TenantUpdate = TablesUpdate<'tenants'>

export type TenantMember = Tables<'tenant_members'>
export type TenantMemberInsert = TablesInsert<'tenant_members'>

export type Suggestion = Tables<'suggestions'>
export type SuggestionInsert = TablesInsert<'suggestions'>

export type BlogPost = Tables<'blog_posts'>
export type BlogPostInsert = TablesInsert<'blog_posts'>
export type BlogPostUpdate = TablesUpdate<'blog_posts'>

export type PublishLogEntry = Tables<'publish_log'>
export type SiteCrawlCache = Tables<'site_crawl_cache'>

export type PostStatus = 'draft' | 'in_review' | 'approved' | 'scheduled' | 'published' | 'rejected'
export type TenantRole = 'admin' | 'author' | 'reviewer'
