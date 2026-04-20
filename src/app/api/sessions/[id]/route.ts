import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { invalidateCache } from '@/lib/cache';

interface ReattributeBody {
  project_key: string;
}

interface MergeBody {
  merge_into_session_id: string;
}

type PatchBody = ReattributeBody | MergeBody;

function isReattribute(b: PatchBody): b is ReattributeBody {
  return 'project_key' in b && typeof (b as ReattributeBody).project_key === 'string';
}

function isMerge(b: PatchBody): b is MergeBody {
  return 'merge_into_session_id' in b && typeof (b as MergeBody).merge_into_session_id === 'string';
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing session id' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isReattribute(body) && !isMerge(body)) {
    return NextResponse.json(
      { success: false, error: 'Body must include either project_key or merge_into_session_id' },
      { status: 400 }
    );
  }

  try {
    if (isReattribute(body)) {
      // ── Re-attribute session to a different entity ──
      const { data, error } = await supabase.rpc('reattribute_session', {
        p_session_id: id,
        p_new_project_key: body.project_key,
      });

      if (error) {
        console.error('reattribute_session RPC error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const result = data as {
        success: boolean;
        previous_project_key?: string;
        audit_event_id?: string;
        error?: string;
      };

      if (!result.success) {
        const status =
          result.error === 'session_not_found' ? 404 :
          result.error === 'target_entity_not_found' ? 404 :
          result.error === 'target_entity_archived' ? 422 :
          result.error === 'cannot_reattribute_live_session' ? 422 : 500;
        return NextResponse.json({ success: false, error: result.error }, { status });
      }

      // Invalidate sessions cache
      invalidateCache('sessions');

      return NextResponse.json({
        success: true,
        action: 'reattribute',
        previous_project_key: result.previous_project_key,
        audit_event_id: result.audit_event_id,
      });
    } else {
      // ── Merge source session into target session ──
      const { data, error } = await supabase.rpc('merge_sessions', {
        p_source_id: id,
        p_target_id: body.merge_into_session_id,
      });

      if (error) {
        console.error('merge_sessions RPC error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const result = data as {
        success: boolean;
        moved_event_count?: number;
        audit_event_id?: string;
        error?: string;
      };

      if (!result.success) {
        const status =
          result.error === 'source_session_not_found' ? 404 :
          result.error === 'target_session_not_found' ? 404 :
          result.error?.includes('live') ? 422 : 500;
        return NextResponse.json({ success: false, error: result.error }, { status });
      }

      // Invalidate sessions cache
      invalidateCache('sessions');

      return NextResponse.json({
        success: true,
        action: 'merge',
        moved_event_count: result.moved_event_count,
        audit_event_id: result.audit_event_id,
      });
    }
  } catch (err) {
    console.error('Sessions PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
