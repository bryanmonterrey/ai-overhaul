// app/api/memory/store/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { key, data, context } = await request.json()
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('User not authenticated')

    // Store in Supabase
    const { data: memoryData, error } = await supabase
      .from('memory_storage')
      .upsert({
        key,
        data,
        context,
        user_id: user.id,
        updated_at: new Date().toISOString()
      })
      .single()

    if (error) throw error

    // Forward to MemGPT service
    const memgptResponse = await fetch('http://localhost:3001/memory/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data, context })
    })

    const memgptData = await memgptResponse.json()

    return NextResponse.json({
      success: true,
      data: {
        supabase: memoryData,
        memgpt: memgptData
      }
    })

  } catch (error) {
    console.error('Error storing memory:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}