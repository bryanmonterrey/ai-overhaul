import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const getSupabase = () => {
  return createClient<Database>(supabaseUrl, supabaseKey);
};

export const getAdminSettings = async () => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('admin_settings')
    .select('*');

  if (error) {
    console.error('Error fetching admin settings:', error);
    return null;
  }

  return data.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, any>);
};

export const updateAdminSetting = async (
  key: string,
  value: any,
  userId: string
) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('admin_settings')
    .update({
      value: JSON.stringify(value),
      updated_by: userId,
      updated_at: new Date().toISOString()
    })
    .eq('key', key);

  if (error) {
    console.error('Error updating admin setting:', error);
    return false;
  }

  return true;
};