/**
 * Supabase Configuration
 * 
 * SECURITY NOTE: 
 * - These values will be replaced by environment variables during deployment
 * - The anon key is safe to expose in the frontend (it's designed for public use)
 * - Row-Level Security (RLS) policies should be enabled in Supabase to protect data
 * - Rate limiting should be configured in Supabase project settings
 * 
 * For local development:
 * 1. Copy this file to qlash-config.js
 * 2. Replace __SUPABASE_URL__ and __SUPABASE_ANON_KEY__ with your actual values
 * 3. Add qlash-config.js to .gitignore
 */

// These placeholders will be replaced during build/deployment
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

// Declare supabaseClient globally
let supabaseClient;
