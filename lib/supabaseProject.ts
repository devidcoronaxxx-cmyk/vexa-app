import { supabase } from './supabase';

interface UpdateProjectData {
  name?: string;
  description?: string | null;
}

export async function updateProject(projectId: string, updates: UpdateProjectData) {
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;

  if (Object.keys(updateData).length === 0) {
    console.warn('No valid fields to update for project', projectId);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId);

    if (error) {
      console.error('Supabase PATCH error:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error during PATCH:', err);
    return null;
  }
}