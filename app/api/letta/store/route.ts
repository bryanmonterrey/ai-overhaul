// app/api/letta/store/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { MemoryType } from '@/app/types/memory'

export async function POST(request: Request) {

  if (!request.headers.get('Content-Type')?.includes('application/json')) {
    return NextResponse.json({ 
      error: 'Content-Type must be application/json' 
    }, { status: 400 });
  }
  
  try {
    const { key, memory_type, data, metadata } = await request.json()
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('User not authenticated')

    // Store in MemGPT service first
    const lettaResponse = await fetch('http://localhost:3001/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        memory_type,
        data,
        metadata: {
          ...metadata,
          user_id: user.id,
        }
      })
    })

    if (!lettaResponse.ok) {
      const errorText = await lettaResponse.text()
      throw new Error(`Letta service error: ${errorText}`)
    }

    const lettaData = await lettaResponse.json()

    if (!lettaData.success) {
      throw new Error(lettaData.error || 'Failed to store in Letta service')
    }

    // Store reference in Supabase
    const { data: memoryData, error } = await supabase
      .from('memories')
      .upsert({
        id: lettaData.data.id,
        key,
        type: memory_type,
        content: typeof data === 'string' ? data : JSON.stringify(data),
        metadata: {
          ...metadata,
          user_id: user.id,
        },
        user_id: user.id,
        platform: metadata?.platform || 'default',
        archive_status: 'active',
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        ...memoryData,
        letta: lettaData.data
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