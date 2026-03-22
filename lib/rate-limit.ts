import { supabase } from './supabase';

export async function checkRateLimit(
  userId: string,
  actionType: 'add_listing' | 'add_review' | 'report_review',
  maxActions: number = 10,
  timeWindowMinutes: number = 60
): Promise<boolean> {
  try {
    const timeAgo = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('rate_limits')
      .select('id')
      .eq('user_id', userId)
      .eq('action_type', actionType)
      .gte('created_at', timeAgo);

    if (error) {
      console.error('Rate limit check error:', error);
      return true;
    }

    return (data?.length || 0) < maxActions;
  } catch (error) {
    console.error('Rate limit error:', error);
    return true;
  }
}

export async function recordAction(userId: string, actionType: string): Promise<void> {
  try {
    await supabase.from('rate_limits').insert({
      user_id: userId,
      action_type: actionType,
    });
  } catch (error) {
    console.error('Failed to record action:', error);
  }
}
