import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Verify Caller is Admin
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser()

    if (authError || !user) throw new Error('Not authenticated')

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') throw new Error('Unauthorized: Admin access required')

    // 2. Perform Action
    const { action, userId, days } = await req.json()

    switch (action) {
      case 'block_user':
        await supabaseClient.from('profiles').update({ status: 'blocked' }).eq('id', userId)
        break
      case 'unblock_user':
        await supabaseClient.from('profiles').update({ status: 'active' }).eq('id', userId)
        break
      case 'force_logout':
        await supabaseClient.auth.admin.signOut(userId)
        break
      case 'activate_subscription':
        const endsAt = new Date()
        endsAt.setDate(endsAt.getDate() + (days || 30))
        await supabaseClient.from('subscriptions').upsert({
          user_id: userId,
          status: 'active',
          plan: 'premium',
          starts_at: new Date().toISOString(),
          ends_at: endsAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        break
      case 'deactivate_subscription':
        await supabaseClient.from('subscriptions').update({ status: 'inactive' }).eq('user_id', userId)
        break
      case 'delete_user':
        await supabaseClient.auth.admin.deleteUser(userId)
        break
      default:
        throw new Error('Unknown action: ' + action)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
