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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { user_agent } = await req.json()
    const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown'
    
    // Simple IP-to-location via a free API or Supabase's geo info if available
    // For now, we use the headers provided by Supabase Edge Functions
    const city = req.headers.get('x-vercel-ip-city') || 'unknown'
    const country = req.headers.get('x-vercel-ip-country') || 'unknown'

    const { error } = await supabaseClient
      .from('login_events')
      .insert({
        user_id: user.id,
        ip,
        city,
        country,
        device: user_agent
      })

    if (error) throw error

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
